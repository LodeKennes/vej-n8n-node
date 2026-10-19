const logo = (await Bun.file('assets/logo.svg').text()).replace(
	'<svg ',
	'<svg x="70" y="35" width="150" height="76" ',
);
const displayFont = Buffer.from(
	await Bun.file('assets/fonts/Fraunces.woff2').arrayBuffer(),
).toString('base64');
const sansFont = Buffer.from(await Bun.file('assets/fonts/VejSans.woff2').arrayBuffer()).toString(
	'base64',
);
const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640" role="img" aria-labelledby="banner-title banner-desc">
<style>@font-face{font-family:VejDisplay;src:url(data:font/woff2;base64,${displayFont}) format('woff2');font-weight:100 900}@font-face{font-family:VejSans;src:url(data:font/woff2;base64,${sansFont}) format('woff2');font-weight:100 900}text{font-family:VejSans,sans-serif}text.headline{font-family:VejDisplay,serif;font-weight:500}</style>
<title id="banner-title">Vej for n8n — state in, probabilities out.</title>
<desc id="banner-desc">Define the outcomes. Connect your next step. Native Choice, Noul, Score and eleven Beta workflows for n8n.</desc>
<rect width="1280" height="640" fill="#F5F2EB"/>
${logo}
<g fill="#565A52" font-family="Arial, sans-serif" font-size="17" letter-spacing="2"><text x="1208" y="80" text-anchor="end">VEJ FOR n8n</text></g>
<path d="M72 135H1208" stroke="#DCD7CB"/>
<g fill="#15181B" font-family="Georgia, serif" font-size="76" letter-spacing="-3">
<text class="headline" x="72" y="244">Define the outcomes.</text><text class="headline" x="72" y="329">Connect your next step.</text></g>
<text x="76" y="383" fill="#565A52" font-family="Arial, sans-serif" font-size="23">Native probabilities for the workflows you already run.</text>
<g font-family="Arial, sans-serif" font-size="19">
<rect x="76" y="450" width="260" height="66" rx="4" fill="#FCFAF5" stroke="#DCD7CB"/>
<text x="100" y="490" fill="#15181B">Your state + questions</text>
<path d="M354 483H422M413 477L422 483L413 489" fill="none" stroke="#245C3A" stroke-width="2"/>
<rect x="444" y="450" width="340" height="66" rx="4" fill="#245C3A"/>
<text x="468" y="490" fill="#FCFAF5">Vej · Choice / Noul / Score</text>
<path d="M802 483H870M861 477L870 483L861 489" fill="none" stroke="#245C3A" stroke-width="2"/>
<rect x="892" y="450" width="312" height="66" rx="4" fill="#FCFAF5" stroke="#DCD7CB"/>
<text x="916" y="490" fill="#15181B">Your next workflow step</text></g>
<path d="M72 560H1208" stroke="#DCD7CB"/>
<g font-family="Arial, sans-serif" font-size="16" fill="#565A52"><text x="76" y="601">11 Beta workflows · evidence, documents, records, conversation</text><text x="1204" y="601" text-anchor="end">itsvej.com</text></g>
</svg>`;
await Bun.write('assets/banner.svg', banner);
