/* Excel export: builds a real .xlsx (styles, merged cells, native charts) in the browser, no libraries.
   Uses the app's own data helpers (S, habitsList, monthStats, scheduled, isDone, streak, …) from app.js. */
'use strict';
(function () {
  const enc = new TextEncoder();
  const X = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hex = (c) => c.replace('#', '').toUpperCase();

  /* ---------------------------------------------------------------- zip (stored) */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u) => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const parts = [], central = []; let off = 0;
    const d = new Date(), dosTime = (d.getHours() << 11) | (d.getMinutes() << 5), dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true);
      c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    }
    const size = central.reduce((a, b) => a + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------------------------------------------------------------- styles */
  const C = { bg: '0B0D1A', panel: '12152B', head: '181C38', line: '252A4A', text: 'ECEDF5', muted: '8E93B3', white: 'FFFFFF', dark: '0B0D1A',
    bad: 'F2545B', mid: 'F4C430', good: '3DD6B0' };
  const WEEK = WEEK_COLORS.map(hex);
  const fonts = [
    [10, false, C.text], [10, true, C.text], [22, true, C.text], [10, false, C.muted], [10, true, C.white], [12, true, C.dark], [15, true, C.text], [10, true, C.dark],
  ];
  const fills = [C.bg, C.panel, ...WEEK, C.bad, C.mid, C.good, C.head]; // fillId = index + 2
  const F = (c) => fills.indexOf(c) + 2;
  const xfs = []; const XF = {};
  function xf(key, font, fill, { h = null, fmt = 0, border = 0 } = {}) {
    XF[key] = xfs.length;
    xfs.push(`<xf numFmtId="${fmt}" fontId="${font}" fillId="${F(fill)}" borderId="${border}" applyFont="1" applyFill="1"${fmt ? ' applyNumberFormat="1"' : ''}${border ? ' applyBorder="1"' : ''}${h ? ` applyAlignment="1"><alignment horizontal="${h}" vertical="center"/></xf>` : '><alignment vertical="center"/></xf>'}`);
  }
  xf('base', 0, C.bg); xf('panel', 0, C.panel); xf('panelB', 1, C.panel); xf('title', 2, C.bg); xf('muted', 3, C.bg);
  xf('panelMuted', 3, C.panel); xf('kpi', 6, C.panel, { h: 'center' }); xf('kpiPct', 6, C.panel, { h: 'center', fmt: 164 });
  xf('kpiDec', 6, C.panel, { h: 'center', fmt: 166 }); xf('kpiLabel', 3, C.panel, { h: 'center' });
  WEEK.forEach((w, i) => { xf('wk' + i, 4, w, { h: 'center' }); xf('done' + i, 5, w, { h: 'center' }); });
  xf('undone', 0, C.panel, { h: 'center' }); xf('off', 3, C.panel, { h: 'center' }); xf('pctS', 3, C.panel, { h: 'center', fmt: 164 });
  xf('numS', 0, C.panel, { h: 'center' });
  xf('pBad', 7, C.bad, { h: 'center', fmt: 165 }); xf('pMid', 7, C.mid, { h: 'center', fmt: 165 }); xf('pGood', 7, C.good, { h: 'center', fmt: 165 });
  xf('th', 1, C.head, { h: 'center', border: 1 }); xf('td', 0, C.panel, { border: 1 }); xf('tdC', 0, C.panel, { h: 'center', border: 1 });
  xf('tdPct', 0, C.panel, { h: 'center', fmt: 165, border: 1 }); xf('tdDate', 0, C.panel, { h: 'center', fmt: 167, border: 1 });
  xf('tdDec', 0, C.panel, { h: 'center', fmt: 166, border: 1 }); xf('tdYes', 7, C.good, { h: 'center', border: 1 }); xf('tdNo', 3, C.panel, { h: 'center', border: 1 });
  xf('section', 1, C.bg);
  const stylesXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4"><numFmt numFmtId="164" formatCode="0%"/><numFmt numFmtId="165" formatCode="0.0%"/><numFmt numFmtId="166" formatCode="0.0"/><numFmt numFmtId="167" formatCode="dd.mm.yyyy"/></numFmts>
<fonts count="${fonts.length}">${fonts.map(([sz, b, col]) => `<font>${b ? '<b/>' : ''}<sz val="${sz}"/><color rgb="FF${col}"/><name val="Arial"/><family val="2"/></font>`).join('')}</fonts>
<fills count="${fills.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map((c) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF${C.line}"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="${F(C.bg)}" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  /* ---------------------------------------------------------------- sheet model */
  const colName = (n) => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const ref = (r, c) => colName(c) + (r + 1);
  const serial = (dk) => { const [y, m, d] = dk.split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };
  const qs = (name) => `'${name.replace(/'/g, "''")}'`;

  class Sheet {
    constructor(name) { this.name = name; this.rows = new Map(); this.merges = []; this.cols = {}; this.heights = {}; this.charts = []; this.freeze = null; this.filter = null; }
    set(r, c, v, st = 'base') {
      if (!this.rows.has(r)) this.rows.set(r, new Map());
      this.rows.get(r).set(c, { v, s: XF[st] });
    }
    merge(r1, c1, r2, c2, v, st) { for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) this.set(r, c, r === r1 && c === c1 ? v : null, st); if (r1 !== r2 || c1 !== c2) this.merges.push(`${ref(r1, c1)}:${ref(r2, c2)}`); }
    fill(r1, c1, r2, c2, st) { for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (!(this.rows.get(r) && this.rows.get(r).has(c))) this.set(r, c, null, st); }
    xml(drawRel, selected) {
      const rows = [...this.rows.keys()].sort((a, b) => a - b).map((r) => {
        const cells = [...this.rows.get(r).entries()].sort((a, b) => a[0] - b[0]).map(([c, { v, s }]) => {
          const rr = ref(r, c);
          if (v == null || v === '') return `<c r="${rr}" s="${s}"/>`;
          if (typeof v === 'number') return `<c r="${rr}" s="${s}"><v>${v}</v></c>`;
          return `<c r="${rr}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${X(v)}</t></is></c>`;
        }).join('');
        const ht = this.heights[r] ? ` ht="${this.heights[r]}" customHeight="1"` : '';
        return `<row r="${r + 1}"${ht}>${cells}</row>`;
      }).join('');
      const cols = Object.keys(this.cols).length ? `<cols>${Object.entries(this.cols).sort((a, b) => a[0] - b[0]).map(([c, w]) => `<col min="${+c + 1}" max="${+c + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
      const pane = this.freeze ? `<pane ySplit="${this.freeze}" topLeftCell="A${this.freeze + 1}" activePane="bottomLeft" state="frozen"/>` : '';
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView rightToLeft="1" showGridLines="0"${selected ? ' tabSelected="1"' : ''} workbookViewId="0">${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="16"/>${cols}<sheetData>${rows}</sheetData>
${this.filter ? `<autoFilter ref="${this.filter}"/>` : ''}${this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToHeight="0"/>${drawRel ? `<drawing r:id="${drawRel}"/>` : ''}</worksheet>`;
    }
  }

  /* ---------------------------------------------------------------- charts (templates follow what Excel itself writes) */
  const txt = (sz, col) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}"><a:solidFill><a:srgbClr val="${col}"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="he-IL"/></a:p></c:txPr>`;
  const title = (t) => `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"><a:solidFill><a:srgbClr val="${C.text}"/></a:solidFill></a:defRPr></a:pPr><a:r><a:rPr lang="he-IL" sz="1200" b="1"><a:solidFill><a:srgbClr val="${C.text}"/></a:solidFill></a:rPr><a:t>${X(t)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
  const cache = (vals, fmt = 'General') => `<c:numCache><c:formatCode>${fmt}</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, i) => (v == null ? '' : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)).join('')}</c:numCache>`;
  const strCache = (vals) => `<c:strCache><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${X(v)}</c:v></c:pt>`).join('')}</c:strCache>`;
  const catAx = (id, cross, pos, del = false) => `<c:catAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${del ? 1 : 0}"/><c:axPos val="${pos}"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:ln></c:spPr>${txt(800, C.muted)}<c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>`;
  const valAx = (id, cross, pos, { min = 0, max = null, fmt = 'General', unit = null, between = 'between' } = {}) => `<c:valAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/>${max != null ? `<c:max val="${max}"/>` : ''}<c:min val="${min}"/></c:scaling><c:delete val="0"/><c:axPos val="${pos}"/><c:majorGridlines><c:spPr><a:ln><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="${X(fmt)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txt(800, C.muted)}<c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:crossBetween val="${between}"/>${unit ? `<c:majorUnit val="${unit}"/>` : ''}</c:valAx>`;
  const space = (plot, legend) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:lang val="he-IL"/><c:roundedCorners val="0"/><c:chart>${plot}${legend ? `<c:legend><c:legendPos val="t"/><c:overlay val="0"/>${txt(900, C.text)}</c:legend>` : ''}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="${C.panel}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>${txt(900, C.text)}</c:chartSpace>`;

  function areaChart(t, catF, cats, valF, vals) {
    const plot = `${title(t)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>
<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${X(t)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="1F8C74"><a:alpha val="60000"/></a:srgbClr></a:solidFill><a:ln w="25400"><a:solidFill><a:srgbClr val="${C.good}"/></a:solidFill></a:ln></c:spPr>
<c:cat><c:numRef><c:f>${catF}</c:f>${cache(cats)}</c:numRef></c:cat><c:val><c:numRef><c:f>${valF}</c:f>${cache(vals, '0%')}</c:numRef></c:val></c:ser>
<c:axId val="11001"/><c:axId val="11002"/></c:areaChart>${catAx(11001, 11002, 'b')}${valAx(11002, 11001, 'l', { max: 1, fmt: '0%', unit: 0.25, between: 'midCat' })}<c:spPr><a:noFill/></c:spPr></c:plotArea>`;
    return space(plot, false);
  }
  function lineChart(t, catF, cats, series) {
    const ser = series.map((s, i) => `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${X(s.name)}</c:v></c:tx><c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${hex(s.color)}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>
<c:cat><c:numRef><c:f>${catF}</c:f>${cache(cats)}</c:numRef></c:cat><c:val><c:numRef><c:f>${s.f}</c:f>${cache(s.vals)}</c:numRef></c:val><c:smooth val="1"/></c:ser>`).join('');
    const plot = `${title(t)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${ser}<c:marker val="1"/><c:axId val="12001"/><c:axId val="12002"/></c:lineChart>${catAx(12001, 12002, 'b')}${valAx(12002, 12001, 'l', { max: 10, unit: 2 })}<c:spPr><a:noFill/></c:spPr></c:plotArea>`;
    return space(plot, true);
  }
  function barChart(t, catF, cats, valF, vals) {
    const pts = vals.map((v, i) => `<c:dPt><c:idx val="${i}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${v == null ? C.line : v < 0.4 ? C.bad : v < 0.7 ? C.mid : C.good}"/></a:solidFill></c:spPr></c:dPt>`).join('');
    const plot = `${title(t)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="0"/>
<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${X(t)}</c:v></c:tx><c:invertIfNegative val="0"/>${pts}
<c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txt(900, C.text)}<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>
<c:cat><c:strRef><c:f>${catF}</c:f>${strCache(cats)}</c:strRef></c:cat><c:val><c:numRef><c:f>${valF}</c:f>${cache(vals, '0%')}</c:numRef></c:val></c:ser>
<c:gapWidth val="60"/><c:axId val="13001"/><c:axId val="13002"/></c:barChart>${catAx(13001, 13002, 'l')}${valAx(13002, 13001, 'b', { max: 1, fmt: '0%', unit: 0.25 })}<c:spPr><a:noFill/></c:spPr></c:plotArea>`;
    return space(plot, false);
  }

  /* ---------------------------------------------------------------- data helpers */
  function allDates() {
    const hs = Object.values(S.habits);
    const keys = [...Object.keys(S.log), ...Object.keys(S.mind), ...hs.map((h) => h.start)].filter(Boolean).sort();
    const first = keys.length ? keys[0] : todayKey(), tk = todayKey();
    const out = []; for (let dk = first; dk <= tk; dk = addDays(dk, 1)) out.push(dk);
    return out;
  }
  function bestStreak(h) {
    let best = 0, cur = 0;
    for (let dk = h.start, tk = todayKey(); dk <= tk; dk = addDays(dk, 1)) {
      if (!h.days.includes(dow(dk))) continue;
      if (isDone(h.id, dk)) { cur++; best = Math.max(best, cur); } else if (dk !== tk) cur = 0;
    }
    return best;
  }
  const monthLabel = (y, m) => `${MONTHS[m]} ${y}`;
  const pctStyle = (p) => (p == null ? 'tdC' : p < 0.4 ? 'pBad' : p < 0.7 ? 'pMid' : 'pGood');

  /* ---------------------------------------------------------------- month sheet (mirrors the tracker) */
  function monthSheet(y, m) {
    const ms = monthStats(y, m), sh = new Sheet(monthLabel(y, m)), n = ms.days.length;
    const D0 = 2, lastC = D0 + n - 1, A0 = lastC + 2; // analysis columns start
    const wk = (d) => Math.min(4, Math.floor((d - 1) / 7));
    sh.cols[0] = 2; sh.cols[1] = 26; for (let c = D0; c <= lastC; c++) sh.cols[c] = 4.6;
    sh.cols[lastC + 1] = 2; sh.cols[A0] = 24; sh.cols[A0 + 1] = 10; sh.cols[A0 + 2] = 10; sh.cols[A0 + 3] = 9;
    sh.heights[1] = 34;
    sh.merge(1, 1, 1, 8, monthLabel(y, m), 'title');
    sh.set(2, 1, '- Habit Tracker -', 'muted');
    const moods = ms.days.map((x) => x.mood).filter(Boolean), mots = ms.days.map((x) => x.motivation).filter(Boolean);
    const avg = (a) => (a.length ? Math.round((a.reduce((p, q) => p + q, 0) / a.length) * 10) / 10 : '');
    const kpis = [['הרגלים פעילים', ms.habits.length, 'kpi'], ['סימונים', ms.done, 'kpi'], ['התקדמות עד היום', ms.pct ?? 0, 'kpiPct'],
      ['ימים מושלמים', ms.perfect, 'kpi'], ['מצב רוח ממוצע', avg(moods), 'kpiDec'], ['מוטיבציה ממוצעת', avg(mots), 'kpiDec']];
    const kw = Math.max(3, Math.floor(n / kpis.length));
    kpis.forEach(([l, v, st], i) => {
      const c1 = D0 + i * kw, c2 = Math.min(lastC, c1 + kw - 1);
      sh.merge(4, c1, 4, c2, l, 'kpiLabel'); sh.merge(5, c1, 5, c2, v, st);
    });
    sh.fill(4, 1, 5, 1, 'panel'); sh.heights[5] = 24;
    // week bands, day letters, day numbers
    const R = 7;
    sh.merge(R, 1, R + 2, 1, 'ההרגלים שלי', 'panelB');
    [0, 1, 2, 3, 4].forEach((w) => {
      const ds = ms.days.filter((x) => wk(x.d) === w); if (!ds.length) return;
      sh.merge(R, D0 + ds[0].d - 1, R, D0 + ds[ds.length - 1].d - 1, `שבוע ${w + 1}`, 'wk' + w);
    });
    ms.days.forEach((x) => { sh.set(R + 1, D0 + x.d - 1, DAY_LETTERS[dow(x.dk)], 'wk' + wk(x.d)); sh.set(R + 2, D0 + x.d - 1, x.d, 'wk' + wk(x.d)); });
    // habits grid
    const H0 = R + 3;
    ms.habits.forEach((h, i) => {
      const r = H0 + i; sh.heights[r] = 20;
      sh.set(r, 1, `${h.emoji} ${h.name}`, 'panel');
      ms.days.forEach((x) => {
        const c = D0 + x.d - 1;
        if (x.future || x.dk < h.start) sh.set(r, c, null, 'undone');
        else if (!scheduled(h, x.dk)) sh.set(r, c, '·', 'off');
        else if (isDone(h.id, x.dk)) sh.set(r, c, '✓', 'done' + wk(x.d));
        else sh.set(r, c, null, 'undone');
      });
    });
    const P = H0 + ms.habits.length;
    const rowsDef = [['התקדמות', (x) => (x.future || x.pct == null ? null : x.pct), 'pctS'], ['בוצעו', (x) => (x.future ? null : x.done), 'numS'],
      ['לא בוצעו', (x) => (x.future ? null : x.total - x.done), 'numS'], [null], ['מצב רוח', (x) => x.mood, 'numS'], ['מוטיבציה', (x) => x.motivation, 'numS'],
      ['ציון מיינדסט', (x) => x.mind, 'pctS']];
    rowsDef.forEach(([label, fn, st], k) => {
      const r = P + k;
      if (!label) { sh.fill(r, 1, r, lastC, 'panel'); return; }
      sh.set(r, 1, label, 'panelMuted');
      ms.days.forEach((x) => sh.set(r, D0 + x.d - 1, fn(x) ?? null, st));
    });
    const progRow = P, moodRow = P + 4, motRow = P + 5;
    // analysis: per habit
    sh.merge(R, A0, R + 1, A0 + 3, 'ניתוח', 'panelB');
    ['הרגל', 'אחוז', 'בוצעו', 'רצף'].forEach((t, i) => sh.set(R + 2, A0 + i, t, 'th'));
    ms.per.forEach((p, i) => {
      const r = H0 + i;
      sh.set(r, A0, `${p.h.emoji} ${p.h.name}`, 'td'); sh.set(r, A0 + 1, p.pct ?? null, pctStyle(p.pct));
      sh.set(r, A0 + 2, `${p.done}/${p.sched}`, 'tdC'); sh.set(r, A0 + 3, streak(p.h), 'tdC');
    });
    // analysis: weekly mindset
    const W0 = P + 1;
    sh.merge(W0, A0, W0, A0 + 3, 'ציון מיינדסט שבועי', 'panelB');
    ms.weeks.forEach((w, i) => { sh.set(W0 + 1 + i, A0, `שבוע ${w.w + 1} (${w.from}–${w.to})`, 'td'); sh.merge(W0 + 1 + i, A0 + 1, W0 + 1 + i, A0 + 3, w.score ?? null, pctStyle(w.score)); });
    // charts under the grid
    const q = qs(sh.name), dayRef = `${q}!$${colName(D0)}$${R + 3}:$${colName(lastC)}$${R + 3}`;
    const rowRef = (r) => `${q}!$${colName(D0)}$${r + 1}:$${colName(lastC)}$${r + 1}`;
    const days = ms.days.map((x) => x.d), top = P + rowsDef.length + 1;
    sh.charts.push({ xml: areaChart('התקדמות יומית', dayRef, days, rowRef(progRow), ms.days.map((x) => (x.future ? null : x.pct))), from: [top, 1], to: [top + 16, Math.min(lastC, 17)] });
    sh.charts.push({
      xml: lineChart('מצב רוח ומוטיבציה', dayRef, days, [
        { name: 'מצב רוח', color: SERIES.mood, f: rowRef(moodRow), vals: ms.days.map((x) => x.mood) },
        { name: 'מוטיבציה', color: SERIES.motivation, f: rowRef(motRow), vals: ms.days.map((x) => x.motivation) }]),
      from: [top, Math.min(lastC, 17) + 1], to: [top + 16, A0 + 3],
    });
    return sh;
  }

  /* ---------------------------------------------------------------- summary sheet */
  function summarySheet(months) {
    const sh = new Sheet('סיכום'), tk = todayKey(), habits = habitsList();
    sh.cols[0] = 2; sh.cols[1] = 26; for (let c = 2; c <= 8; c++) sh.cols[c] = 14; sh.cols[9] = 3; sh.cols[10] = 12;
    sh.heights[1] = 34;
    sh.merge(1, 1, 1, 6, 'סיכום הרגלים', 'title');
    const now = new Date();
    sh.merge(2, 1, 2, 6, `עודכן ${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())} · כל הנתונים מהאפליקציה, כולל כל המכשירים המחוברים`, 'muted');
    const per = habits.map((h) => {
      let sched = 0, done = 0;
      for (let dk = h.start; dk <= tk; dk = addDays(dk, 1)) if (scheduled(h, dk)) { sched++; if (isDone(h.id, dk)) done++; }
      return { h, sched, done, pct: sched ? done / sched : null, cur: streak(h), best: bestStreak(h) };
    });
    const totalDone = per.reduce((a, p) => a + p.done, 0), totalSched = per.reduce((a, p) => a + p.sched, 0);
    const perfect = months.reduce((a, x) => a + x.perfect, 0);
    const kpis = [['סימונים מאז ההתחלה', totalDone, 'kpi'], ['אחוז ביצוע כולל', totalSched ? totalDone / totalSched : 0, 'kpiPct'],
      ['ימים מושלמים', perfect, 'kpi'], ['רצף שיא', Math.max(0, ...per.map((p) => p.best)), 'kpi']];
    kpis.forEach(([l, v, st], i) => { const c1 = 1 + i * 2 - (i ? 1 : 0), c2 = c1 + (i ? 1 : 0); sh.merge(4, c1, 4, c2, l, 'kpiLabel'); sh.merge(5, c1, 5, c2, v, st); });
    sh.heights[5] = 26;
    // habits table
    let r = 7;
    sh.set(r, 1, 'לפי הרגל', 'section'); r++;
    const head = ['הרגל', 'ימים', 'התחלה', 'ימים מתוכננים', 'בוצעו', 'אחוז ביצוע', 'רצף נוכחי', 'רצף שיא'];
    head.forEach((t, i) => sh.set(r, 1 + i, t, 'th'));
    const hStart = r + 1;
    per.forEach((p, i) => {
      const rr = hStart + i;
      sh.set(rr, 1, `${p.h.emoji} ${p.h.name}`, 'td'); sh.set(rr, 2, daysSummary(p.h.days), 'tdC'); sh.set(rr, 3, serial(p.h.start), 'tdDate');
      sh.set(rr, 4, p.sched, 'tdC'); sh.set(rr, 5, p.done, 'tdC'); sh.set(rr, 6, p.pct ?? null, pctStyle(p.pct)); sh.set(rr, 7, p.cur, 'tdC'); sh.set(rr, 8, p.best, 'tdC');
    });
    r = hStart + per.length + 2;
    sh.set(r, 1, 'לפי חודש', 'section'); r++;
    ['חודש', 'הרגלים', 'סימונים', 'אחוז ביצוע', 'ימים מושלמים', 'מצב רוח', 'מוטיבציה'].forEach((t, i) => sh.set(r, 1 + i, t, 'th'));
    months.forEach((x, i) => {
      const rr = r + 1 + i, moods = x.days.map((d) => d.mood).filter(Boolean), mots = x.days.map((d) => d.motivation).filter(Boolean);
      const avg = (a) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : null);
      sh.set(rr, 1, monthLabel(x.y, x.m), 'td'); sh.set(rr, 2, x.habits.length, 'tdC'); sh.set(rr, 3, x.done, 'tdC');
      sh.set(rr, 4, x.pct ?? null, pctStyle(x.pct)); sh.set(rr, 5, x.perfect, 'tdC'); sh.set(rr, 6, avg(moods), 'tdDec'); sh.set(rr, 7, avg(mots), 'tdDec');
    });
    const q = qs(sh.name);
    if (per.length) {
      sh.charts.push({
        xml: barChart('אחוז ביצוע לפי הרגל', `${q}!$B$${hStart + 1}:$B$${hStart + per.length}`, per.map((p) => `${p.h.emoji} ${p.h.name}`),
          `${q}!$G$${hStart + 1}:$G$${hStart + per.length}`, per.map((p) => p.pct)),
        from: [7, 10], to: [7 + Math.max(16, per.length * 2 + 4), 18],
      });
    }
    return sh;
  }

  /* ---------------------------------------------------------------- log sheet */
  function logSheet() {
    const sh = new Sheet('יומן'), habits = Object.values(S.habits).filter((h) => !h.deleted).sort((a, b) => a.order - b.order);
    sh.cols[0] = 12; sh.cols[1] = 9; sh.cols[2] = 26; sh.cols[3] = 10; sh.cols[4] = 10; sh.cols[5] = 10;
    ['תאריך', 'יום', 'הרגל', 'בוצע', 'מצב רוח', 'מוטיבציה'].forEach((t, i) => sh.set(0, i, t, 'th'));
    let r = 1;
    const dates = allDates().reverse();
    for (const dk of dates) {
      const mood = mindVal(dk, 'mood'), mot = mindVal(dk, 'motivation');
      for (const h of habits) {
        if (!scheduled(h, dk)) continue;
        const done = isDone(h.id, dk);
        sh.set(r, 0, serial(dk), 'tdDate'); sh.set(r, 1, DAY_NAMES[dow(dk)], 'tdC'); sh.set(r, 2, `${h.emoji} ${h.name}`, 'td');
        sh.set(r, 3, done ? '✓' : '✗', done ? 'tdYes' : 'tdNo'); sh.set(r, 4, mood, 'tdC'); sh.set(r, 5, mot, 'tdC');
        r++;
      }
    }
    sh.freeze = 1; sh.filter = `A1:F${Math.max(2, r)}`;
    return sh;
  }

  /* ---------------------------------------------------------------- workbook */
  function build() {
    const tk = todayKey(), dates = allDates();
    const first = parseKey(dates[0]), last = parseKey(tk);
    const months = [];
    for (let y = first.getFullYear(), m = first.getMonth(); y < last.getFullYear() || (y === last.getFullYear() && m <= last.getMonth()); m === 11 ? (m = 0, y++) : m++) months.push(monthStats(y, m));
    const sheets = [summarySheet(months), ...months.slice().reverse().map((x) => monthSheet(x.y, x.m)), logSheet()];
    const files = [];
    const ct = [], wbRels = [], sheetEls = [];
    let chartN = 0, drawN = 0;
    sheets.forEach((sh, i) => {
      const idx = i + 1; let drawRel = null;
      if (sh.charts.length) {
        drawN++; drawRel = 'rId1';
        const anchors = [], dRels = [];
        sh.charts.forEach((ch, k) => {
          chartN++;
          files.push({ name: `xl/charts/chart${chartN}.xml`, data: ch.xml });
          ct.push(`<Override PartName="/xl/charts/chart${chartN}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
          dRels.push(`<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartN}.xml"/>`);
          anchors.push(`<xdr:twoCellAnchor><xdr:from><xdr:col>${ch.from[1]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${ch.from[0]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${ch.to[1]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${ch.to[0]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${k + 2}" name="Chart ${k + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${k + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`);
        });
        files.push({ name: `xl/drawings/drawing${drawN}.xml`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors.join('')}</xdr:wsDr>` });
        files.push({ name: `xl/drawings/_rels/drawing${drawN}.xml.rels`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${dRels.join('')}</Relationships>` });
        ct.push(`<Override PartName="/xl/drawings/drawing${drawN}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
        files.push({ name: `xl/worksheets/_rels/sheet${idx}.xml.rels`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawN}.xml"/></Relationships>` });
      }
      files.push({ name: `xl/worksheets/sheet${idx}.xml`, data: sh.xml(drawRel, i === 0) });
      ct.push(`<Override PartName="/xl/worksheets/sheet${idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
      wbRels.push(`<Relationship Id="rId${idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx}.xml"/>`);
      sheetEls.push(`<sheet name="${X(sh.name)}" sheetId="${idx}" r:id="rId${idx}"/>`);
    });
    const logIdx = sheets.length - 1;
    const names = `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="${logIdx}" hidden="1">${qs(sheets[logIdx].name)}!${sheets[logIdx].filter.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}</definedName></definedNames>`;
    const n = sheets.length;
    const head = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${ct.join('')}</Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
      { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>סיכום הרגלים</dc:title><dc:creator>מעקב הרגלים</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` },
      { name: 'docProps/app.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application></Properties>` },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheetEls.join('')}</sheets>${names}<calcPr calcId="191029"/></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels.join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: stylesXml() },
    ];
    return zip([...head, ...files]);
  }

  window.HabitsExport = { build };
})();
