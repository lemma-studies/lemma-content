// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
// import starlightGiscus from 'starlight-giscus';  // TODO(2b): re-enable once Discussions is enabled on lemma-studies/lemma-content and new repoId/categoryId are captured
import { readFileSync } from 'fs';

// Slugs currently stubbed with "Migration Queued" — exclude from sitemap so
// search engines don't index the transitional state. Remove entries here as
// each study migrates to canonical /studies/<slug>/ content (Phase 3+).
// Studies still stubbed out (Migration Queued / Planned — excluded from sitemap
// so search engines don't index the placeholder state). Removed 2026-08-12
// mass-migration: what-is-the-perfect (LIVE), wine-and-jesus (LIVE), trumpet-call
// (LIVE), by-his-stripes (LIVE-tree), and 7 DRAFT-marked studies. Only the 4
// truly-planned (no Vault content yet) slugs remain excluded.
const STUBBED_SLUGS = new Set([
	// parents-and-adult-children — migrated 2026-08-12 (11 chapter split from v2.16.0)
	'pre-nicene-christianity',
	'apostolic-quadrilateral',
	'lords-supper-research',
	// translations — placeholder section until family-discipleship editions land
	'translations',
]);

const tag = readFileSync(new URL('./src/version.generated.mjs', import.meta.url), 'utf8')
	.match(/TAG = "([^"]+)"/)?.[1] || '0.0';

// https://astro.build/config
export default defineConfig({
	site: 'https://lemma.gig8.com',
	server: { host: '0.0.0.0' },
	vite: { server: { allowedHosts: ['dev.gig8.com'] } },
	integrations: [
		sitemap({
			filter: (page) => {
				// Extract the first path segment (the slug).
				const path = new URL(page).pathname.replace(/^\/+|\/+$/g, '');
				const slug = path.split('/')[0];
				return !STUBBED_SLUGS.has(slug);
			},
		}),
		starlight({
			// TODO(2b): re-attach starlightGiscus plugin with new repo=lemma-studies/lemma-content
			// after Discussions is enabled and repoId+categoryId are captured.
			plugins: [],
			title: `Lemma v${tag}`,
			description: 'A theological reference library: exegetical studies using the SCAR Quadrilateral framework',
			components: {
				Footer: './src/components/Footer.astro',
				Head: './src/components/Head.astro',
			},
			sidebar: [
				{
					label: 'About',
					autogenerate: { directory: 'about' },
				},
				{
					label: 'Studies',
					collapsed: false,
					items: [
						// LIVE (real content, no draft banner)
						{ label: 'What Is the Perfect?',            collapsed: true, autogenerate: { directory: 'what-is-the-perfect' } },
						{ label: 'Kept the Good Wine Until Now',    collapsed: true, autogenerate: { directory: 'wine-and-jesus' } },
						{ label: 'Trumpet Call Study',              collapsed: true, autogenerate: { directory: 'trumpet-call' } },
						{ label: 'By His Stripes',                  collapsed: true, autogenerate: { directory: 'by-his-stripes' } },
						// DRAFT (banner: under development)
						{ label: 'Under Whose Roof?',               collapsed: true, autogenerate: { directory: 'parents-and-adult-children' } },
						{ label: 'The Name Above Every Name',       collapsed: true, autogenerate: { directory: 'name-above-every-name' } },
						{ label: 'Sermon on the Mount',             collapsed: true, autogenerate: { directory: 'sermon-on-the-mount' } },
						{ label: "Satan's Throne",                  collapsed: true, autogenerate: { directory: 'satans-throne' } },
						{ label: 'The Angel of the Lord',           collapsed: true, autogenerate: { directory: 'angel-of-the-lord' } },
						{ label: 'Meeting Structure',               collapsed: true, autogenerate: { directory: 'meeting-structure' } },
						{ label: '1 Corinthians 11:17-34',          collapsed: true, autogenerate: { directory: '1-corinthians-11-17-34' } },
						{ label: 'Amos 7:1 Study',                  collapsed: true, autogenerate: { directory: 'amos-7-1' } },
						{ label: 'Daniel 9:24 Study',               collapsed: true, autogenerate: { directory: 'daniel-9-24' } },
						// Reference articles + research notes (non-SCAR-quadrilateral scholarly work)
						{
							label: 'Reference & Research',
							collapsed: true,
							items: [
								{ label: 'Pre-Nicene Christianity',      autogenerate: { directory: 'pre-nicene-christianity' } },
								{ label: 'Apostolic Quadrilateral',      autogenerate: { directory: 'apostolic-quadrilateral' } },
								{ label: "Lord's Supper Research",       autogenerate: { directory: 'lords-supper-research' } },
							],
						},
					],
				},
				{
					label: 'Translations',
					collapsed: false,
					autogenerate: { directory: 'translations' },
				},
			],
		}),
	],
});
