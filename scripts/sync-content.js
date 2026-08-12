#!/usr/bin/env node

/**
 * sync-content.js
 *
 * Reads content-sources.yaml and syncs Obsidian Vault content into
 * src/content/docs/ with Starlight-compatible adaptations:
 *   - Frontmatter injection (title from # heading, sidebar order)
 *   - Wiki-link conversion to standard markdown links
 *   - Filename normalization (lowercase, hyphens)
 *   - Duplicate H1 removal
 *   - Obsidian-only frontmatter field stripping
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'src', 'content', 'docs');
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'content-sources.yaml');

// Obsidian-only frontmatter fields to strip
const OBSIDIAN_FIELDS = new Set([
	'tags', 'status', 'priority', 'start_date', 'area', 'type',
	'created', 'modified', 'review_frequency', 'last_updated',
	'aliases', 'cssclass', 'cssclasses', 'publish',
]);

// ─── Main ────────────────────────────────────────────────────────

async function main() {
	const manifestRaw = await fs.readFile(MANIFEST_PATH, 'utf8');
	const manifest = yaml.load(manifestRaw);
	const vaultRoot = manifest.vault_root;

	// Build a global link resolution table for wiki-link conversion
	const linkTable = buildLinkTable(manifest, vaultRoot);

	let totalFiles = 0;
	let totalErrors = 0;

	for (const source of manifest.sources) {
		try {
			const count = await syncSource(source, vaultRoot, linkTable);
			totalFiles += count;
		} catch (err) {
			console.error(`  ERROR syncing "${source.target}": ${err.message}`);
			totalErrors++;
		}
	}

	console.log(`\nSync complete: ${totalFiles} files synced, ${totalErrors} errors`);
	if (totalErrors > 0) process.exit(1);
}

// ─── Source syncing ──────────────────────────────────────────────

async function syncSource(source, vaultRoot, linkTable) {
	const sourcePath = source.local_path || path.join(vaultRoot, source.vault_path);
	const targetDir = path.join(DOCS_DIR, source.target);

	// Check if source is a single file (article type pointing to a file)
	const stat = await fs.stat(sourcePath).catch(() => null);
	if (!stat) {
		console.error(`  WARNING: Source not found: ${sourcePath}`);
		return 0;
	}

	if (stat.isFile()) {
		return await syncSingleFile(source, sourcePath, vaultRoot, linkTable);
	}

	// It's a directory - clean target dir first (except hand-maintained files)
	await ensureCleanDir(targetDir);

	const excludeSet = new Set(source.exclude || []);
	const isGlob = (e) => e.includes('*') || /\[[^\]]+\]/.test(e);
	const excludeGlobs = [...excludeSet].filter(isGlob);
	const excludeNames = [...excludeSet].filter(e => !isGlob(e));

	const entries = await fs.readdir(sourcePath, { withFileTypes: true });
	let count = 0;

	// For passthrough sources, build a set of subdirectory names so we can
	// rewrite absolute internal links (e.g. /01-scripture/ -> /by-his-stripes/01-scripture/)
	let passthroughSubdirs = null;
	if (source.passthrough) {
		passthroughSubdirs = entries
			.filter(e => e.isDirectory() && !excludeNames.includes(e.name))
			.map(e => e.name);

		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (!excludeNames.includes(entry.name)) {
					const subCount = await copyDirPassthrough(
						path.join(sourcePath, entry.name),
						path.join(targetDir, entry.name),
						excludeNames,
						source.target,
						passthroughSubdirs,
					);
					count += subCount;
				}
				continue;
			}
			if (!entry.name.endsWith('.md') && !entry.name.endsWith('.mdx')) continue;
			if (excludeNames.includes(entry.name)) continue;
			if (excludeGlobs.some(g => matchGlob(g, entry.name))) continue;

			const filePath = path.join(sourcePath, entry.name);
			const targetPath = path.join(targetDir, entry.name);
			await fs.mkdir(path.dirname(targetPath), { recursive: true });
			let content = await fs.readFile(filePath, 'utf8');
			content = rewritePassthroughLinks(content, source.target, passthroughSubdirs);
			await fs.writeFile(targetPath, content, 'utf8');
			count++;
		}
	} else {
		// Recursively collect all markdown files with relative paths
		const allFiles = await collectMarkdownFiles(sourcePath, '', excludeNames, excludeGlobs);

		for (const relPath of allFiles) {
			const filePath = path.join(sourcePath, relPath);

			// file_map keys can be relative paths (e.g. "Chapters/Ch03.md") or bare filenames
			const fileConfig = source.file_map?.[relPath] || {};
			const targetFilename = fileConfig.target || normalizeFilename(path.basename(relPath));
			const targetPath = path.join(targetDir, targetFilename);

			await fs.mkdir(path.dirname(targetPath), { recursive: true });

			const raw = await fs.readFile(filePath, 'utf8');
			const adapted = adaptContent(raw, {
				fileConfig,
				source,
				linkTable,
				targetTopic: source.target,
			});

			await fs.writeFile(targetPath, adapted, 'utf8');
			count++;
		}
	}

	// Generate an index page if none was synced and the source has a label/description
	const indexPath = path.join(targetDir, 'index.md');
	const hasIndexMd = await fs.stat(indexPath).then(() => true).catch(() => false);
	const hasIndexMdx = await fs.stat(path.join(targetDir, 'index.mdx')).then(() => true).catch(() => false);
	const hasIndex = hasIndexMd || hasIndexMdx;
	if (!hasIndex && source.label) {
		const indexFm = {
			title: source.label,
			...(source.description ? { description: source.description } : {}),
			sidebar: { order: 0 },
		};
		const indexBody = source.description ? `\n${source.description}\n` : '';
		await fs.writeFile(indexPath, matter.stringify(indexBody, indexFm), 'utf8');
		count++;
	}

	console.log(`  ${source.target}: ${count} files`);
	return count;
}

async function syncSingleFile(source, sourcePath, vaultRoot, linkTable) {
	const targetPath = path.join(DOCS_DIR, source.target);
	await fs.mkdir(path.dirname(targetPath), { recursive: true });

	const raw = await fs.readFile(sourcePath, 'utf8');

	const fileConfig = {
		order: source.order,
		title: source.title_override,
	};

	const adapted = adaptContent(raw, {
		fileConfig,
		source,
		linkTable,
		targetTopic: path.dirname(source.target),
	});

	await fs.writeFile(targetPath, adapted, 'utf8');
	console.log(`  ${source.target}: 1 file (article)`);
	return 1;
}

async function copyDirPassthrough(src, dest, excludeNames, targetPrefix, subdirs) {
	await fs.mkdir(dest, { recursive: true });
	const entries = await fs.readdir(src, { withFileTypes: true });
	let count = 0;

	for (const entry of entries) {
		if (excludeNames.includes(entry.name)) continue;

		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			count += await copyDirPassthrough(srcPath, destPath, excludeNames, targetPrefix, subdirs);
		} else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
			let content = await fs.readFile(srcPath, 'utf8');
			content = rewritePassthroughLinks(content, targetPrefix, subdirs);
			await fs.writeFile(destPath, content, 'utf8');
			count++;
		} else {
			// Copy non-markdown assets too (images, etc.)
			await fs.copyFile(srcPath, destPath);
		}
	}

	return count;
}

/**
 * Recursively collect all markdown files from a directory tree.
 * Returns relative paths (e.g. "Chapters/Ch03-Chapter-Scripture.md").
 * Skips excluded directories and files.
 */
async function collectMarkdownFiles(baseDir, relDir, excludeNames, excludeGlobs) {
	const dirPath = relDir ? path.join(baseDir, relDir) : baseDir;
	const entries = await fs.readdir(dirPath, { withFileTypes: true });
	const results = [];

	for (const entry of entries) {
		const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;

		// Check exclusions against both bare name and relative path
		if (excludeNames.includes(entry.name) || excludeNames.includes(relPath)) continue;

		if (entry.isDirectory()) {
			const subFiles = await collectMarkdownFiles(baseDir, relPath, excludeNames, excludeGlobs);
			results.push(...subFiles);
		} else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
			if (!excludeGlobs.some(g => matchGlob(g, entry.name))) {
				results.push(relPath);
			}
		}
	}

	return results;
}

/**
 * Rewrite absolute internal links in passthrough content.
 * Links like /01-scripture/ become /by-his-stripes/01-scripture/
 * when the content is nested under a target prefix.
 */
function rewritePassthroughLinks(content, targetPrefix, subdirs) {
	if (!subdirs || subdirs.length === 0) return content;

	// Build a regex that matches absolute links starting with any known subdirectory
	// Matches both markdown links ](/path) and frontmatter links (link: /path)
	const subdirPattern = subdirs.map(escapeRegex).join('|');
	const regex = new RegExp(`(\\]\\(|link:\\s*)/(?=(${subdirPattern})/)`, 'g');

	return content.replace(regex, `$1/${targetPrefix}/`);
}

// ─── Frontmatter fixup ───────────────────────────────────────────

/**
 * Quote unquoted YAML values that contain colons to prevent parse errors.
 * e.g. `title: Chapter 1: Foo` → `title: "Chapter 1: Foo"`
 */
function fixFrontmatterColons(raw) {
	const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) return raw;

	const fixed = fmMatch[1].replace(/^(\w+):\s+(.+)$/gm, (line, key, value) => {
		// Skip if already quoted or doesn't contain a problematic colon
		if (/^["']/.test(value) || !/:/.test(value)) return line;
		// Quote the value with double quotes, escaping any existing double quotes
		return `${key}: "${value.replace(/"/g, '\\"')}"`;
	});

	return raw.replace(fmMatch[1], fixed);
}

// ─── Content adaptation ──────────────────────────────────────────

function adaptContent(raw, { fileConfig, source, linkTable, targetTopic }) {
	// Pre-process: quote frontmatter values containing colons to avoid YAML parse errors
	// (common in Obsidian files with titles like "Chapter 1: Scripture")
	const safeRaw = fixFrontmatterColons(raw);
	const { data: frontmatter, content: body } = matter(safeRaw);

	// Strip Obsidian-only fields
	for (const field of OBSIDIAN_FIELDS) {
		delete frontmatter[field];
	}

	// Clean up stray characters before first heading (common Obsidian artifact)
	let cleanBody = body.replace(/^[^#\n]*?(#\s+)/m, (match, heading) => {
		// Only strip if there's junk before the # on the same line
		if (match !== heading) return heading;
		return match;
	});

	// Extract title from first # heading if no title in frontmatter
	if (!frontmatter.title) {
		const headingMatch = cleanBody.match(/^#\s+(.+)$/m);
		if (headingMatch) {
			frontmatter.title = headingMatch[1].trim();
		}
	}

	// Override title if specified in config
	if (fileConfig.title) {
		frontmatter.title = fileConfig.title;
	}

	// Fallback title from filename
	if (!frontmatter.title) {
		frontmatter.title = 'Untitled';
	}

	// Remove the first H1 heading to avoid duplication with Starlight's
	// frontmatter-rendered title (doesn't require exact match)
	cleanBody = cleanBody.replace(/^#\s+.+$/m, '');
	// Clean up leading whitespace after removal
	cleanBody = cleanBody.replace(/^\n{2,}/, '\n');

	// Set sidebar order if specified
	if (fileConfig.order !== undefined) {
		frontmatter.sidebar = frontmatter.sidebar || {};
		frontmatter.sidebar.order = fileConfig.order;
	}

	// Convert wiki-links to standard markdown
	cleanBody = convertWikiLinks(cleanBody, linkTable, targetTopic);

	// Rebuild the file with frontmatter
	return matter.stringify(cleanBody, frontmatter);
}

// ─── Wiki-link conversion ────────────────────────────────────────

function buildLinkTable(manifest, vaultRoot) {
	const table = new Map();

	for (const source of manifest.sources) {
		if (source.passthrough) continue;

		const fileMap = source.file_map || {};
		for (const [srcName, config] of Object.entries(fileMap)) {
			// Map the Vault filename (without extension) to the Starlight slug
			const key = srcName.replace(/\.md$/, '');
			const slug = config.target.replace(/\.md$/, '').replace(/\/index$/, '');
			const resolved = `/${source.target}/${slug}/`.replace(/\/+/g, '/');
			table.set(key, resolved);
			// Also register the bare filename for subdirectory paths
			// so wiki-links like [[Ch03-Chapter-Scripture]] resolve correctly
			const baseName = path.basename(key);
			if (baseName !== key) {
				table.set(baseName, resolved);
			}
		}
	}

	return table;
}

function convertWikiLinks(body, linkTable, currentTopic) {
	// Match [[Target|Display]] and [[Target]]
	return body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, target, display) => {
		const displayText = display || target;
		const cleanTarget = target.trim();

		// Try to resolve in the link table
		const resolved = linkTable.get(cleanTarget);
		if (resolved) {
			return `[${displayText}](${resolved})`;
		}

		// If unresolvable, output as plain text with a note
		return displayText;
	});
}

// ─── Filename normalization ──────────────────────────────────────

function normalizeFilename(name) {
	return name
		.replace(/\.md$/, '')        // Remove extension
		.toLowerCase()               // Lowercase
		.replace(/\s+/g, '-')        // Spaces to hyphens
		.replace(/[^a-z0-9-]/g, '')  // Remove special chars
		.replace(/-+/g, '-')         // Collapse multiple hyphens
		.replace(/^-|-$/g, '')       // Trim leading/trailing hyphens
		+ '.md';
}

// ─── Utilities ───────────────────────────────────────────────────

async function ensureCleanDir(dir) {
	await fs.rm(dir, { recursive: true, force: true });
	await fs.mkdir(dir, { recursive: true });
}

function matchGlob(glob, filename) {
	// General glob matching: * matches any run of characters, [a-z] char classes pass through.
	// Supports leading, trailing, and interior stars ("*.docx", "Draft-v*.md", "*.tmp.*").
	const re = new RegExp(
		'^' +
			glob
				.split(/(\*|\[[^\]]+\])/)
				.map((part) => {
					if (part === '*') return '.*';
					if (/^\[[^\]]+\]$/.test(part)) return part;
					return escapeRegex(part);
				})
				.join('') +
			'$'
	);
	return re.test(filename);
}

function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Run ─────────────────────────────────────────────────────────

main().catch(err => {
	console.error('Sync failed:', err);
	process.exit(1);
});
