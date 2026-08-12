// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
// import starlightGiscus from 'starlight-giscus';  // TODO(2b): re-enable once Discussions is enabled on lemma-studies/lemma-content and new repoId/categoryId are captured
import { readFileSync } from 'fs';

const tag = readFileSync(new URL('./src/version.generated.mjs', import.meta.url), 'utf8')
	.match(/TAG = "([^"]+)"/)?.[1] || '0.0';

// https://astro.build/config
export default defineConfig({
	site: 'https://lemma.gig8.com',
	server: { host: '0.0.0.0' },
	vite: { server: { allowedHosts: ['dev.gig8.com'] } },
	integrations: [
		starlight({
			// TODO(2b): re-attach starlightGiscus plugin with new repo=lemma-studies/lemma-content
			// after Discussions is enabled and repoId+categoryId are captured.
			plugins: [],
			title: `Lemma v${tag}`,
			description: 'A theological reference library: exegetical studies using the SCAR Quadrilateral framework',
			components: {
				Footer: './src/components/Footer.astro',
			},
			sidebar: [
				{
					label: 'About',
					autogenerate: { directory: 'about' },
				},
				{
					label: 'By His Stripes',
					collapsed: true,
					autogenerate: { directory: 'by-his-stripes' },
				},
				{
					label: 'Meeting Structure',
					collapsed: true,
					autogenerate: { directory: 'meeting-structure' },
				},
				{
					label: '1 Corinthians 11:17-34',
					collapsed: true,
					autogenerate: { directory: '1-corinthians-11-17-34' },
				},
				{
					label: 'The Name Above Every Name',
					collapsed: true,
					autogenerate: { directory: 'name-above-every-name' },
				},
				{
					label: 'Amos 7:1 Study',
					collapsed: true,
					autogenerate: { directory: 'amos-7-1' },
				},
				{
					label: 'Daniel 9:24 Study',
					collapsed: true,
					autogenerate: { directory: 'daniel-9-24' },
				},
				{
					label: 'Trumpet Call Study',
					collapsed: true,
					autogenerate: { directory: 'trumpet-call' },
				},
				{
					label: 'What Is the Perfect?',
					collapsed: true,
					autogenerate: { directory: 'what-is-the-perfect' },
				},
				{
					label: 'Sermon on the Mount',
					collapsed: true,
					autogenerate: { directory: 'sermon-on-the-mount' },
				},
				{
					label: "Satan's Throne",
					collapsed: true,
					autogenerate: { directory: 'satans-throne' },
				},
				{
					label: 'The Angel of the Lord',
					collapsed: true,
					autogenerate: { directory: 'angel-of-the-lord' },
				},
				{
					label: 'Under Whose Roof?',
					collapsed: true,
					autogenerate: { directory: 'parents-and-adult-children' },
				},
				{
					label: 'Kept the Good Wine Until Now',
					collapsed: true,
					autogenerate: { directory: 'wine-and-jesus' },
				},
				{
					label: 'Reference Articles',
					collapsed: true,
					items: [
						{ label: 'Pre-Nicene Christianity', autogenerate: { directory: 'pre-nicene-christianity' } },
						{ label: 'Apostolic Quadrilateral', autogenerate: { directory: 'apostolic-quadrilateral' } },
					],
				},
				{
					label: 'Research Notes',
					collapsed: true,
					items: [
						{ label: "Lord's Supper Research", autogenerate: { directory: 'lords-supper-research' } },
					],
				},
			],
		}),
	],
});
