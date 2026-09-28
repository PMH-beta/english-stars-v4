// 1:1 aus src/modules/campaign-fight.js (_arenaScene, _hillsScene) und src/style.css (.cf-grass).
export function arenaScene() {
  const px = (x, y, w, h, c, o) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"${o ? ` opacity="${o}"` : ''}/>`;
  let s = '<rect x="0" y="0" width="128" height="72" fill="url(#cfSky)"/>';
  s += px(102, 6, 20, 10, '#ffd84d') + px(104, 4, 16, 14, '#ffd84d') + px(106, 2, 12, 18, '#ffd84d')
    + px(106, 6, 10, 8, '#fff3bf') + px(108, 4, 6, 3, '#fffbe6');
  s += px(98, 10, 3, 1, '#ffe8a0') + px(122, 10, 4, 1, '#ffe8a0') + px(111, 0, 1, 2, '#ffe8a0');
  s += px(96, 0, 2, 72, '#ffffff', '.10') + px(88, 0, 1, 72, '#ffffff', '.08')
    + px(74, 0, 2, 72, '#ffffff', '.06');
  s += px(30, 5, 12, 2, '#ffffff', '.55') + px(27, 6, 18, 2, '#ffffff', '.55');
  s += px(60, 11, 10, 2, '#ffffff', '.45') + px(58, 12, 14, 2, '#ffffff', '.45');
  s += px(8, 9, 16, 3, '#ffffff') + px(4, 11, 24, 3, '#ffffff') + px(12, 7, 10, 3, '#ffffff')
    + px(6, 11, 20, 1, '#e8f4ff');
  s += px(86, 16, 14, 3, '#ffffff') + px(82, 18, 22, 3, '#ffffff') + px(84, 18, 18, 1, '#e8f4ff');
  s += px(46, 16, 1, 1, '#7fa6c4') + px(47, 15, 2, 1, '#7fa6c4') + px(49, 16, 1, 1, '#7fa6c4');
  s += px(54, 21, 1, 1, '#7fa6c4') + px(55, 20, 2, 1, '#7fa6c4') + px(57, 21, 1, 1, '#7fa6c4');
  return `<svg viewBox="0 0 128 72" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;image-rendering:pixelated;" aria-hidden="true">
    <defs><linearGradient id="cfSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6bbcf5"/><stop offset="0.55" stop-color="#a8dcff"/><stop offset="1" stop-color="#eaf6ff"/>
    </linearGradient></defs>${s}</svg>`;
}
export function hillsScene() {
  const layers = [
    [[6, 9, 12, 10, 7, 5, 8, 11, 13, 10, 7, 9, 12, 8, 6, 9], '#6d93a8', '#7fa6bb'],
    [[12, 15, 13, 17, 20, 16, 13, 15, 18, 21, 17, 14, 16, 19, 15, 13], '#4e7f57', '#5d9163'],
    [[20, 23, 26, 22, 19, 22, 25, 27, 24, 21, 23, 26, 22, 20, 23, 25], '#5d9a4a', '#74b45c'],
  ];
  let s = '';
  for (const [prof, base, edge] of layers) {
    prof.forEach((top, i) => {
      s += `<rect x="${i * 8}" y="${top}" width="8" height="${32 - top}" fill="${base}"/>`
        + `<rect x="${i * 8}" y="${top}" width="8" height="1" fill="${edge}"/>`;
    });
  }
  return `<svg viewBox="0 0 128 32" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;image-rendering:pixelated;" aria-hidden="true">${s}</svg>`;
}
