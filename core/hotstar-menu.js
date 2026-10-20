/**
 * [shai] JioHotstar player menu remote control.
 * The Quality list (Auto / Full HD / HD / Data Saver) can't be reached by
 * spatial navigation or pointer clicks on Tizen. While that list is visible,
 * Down enters it, Up/Down move, OK selects, Up at the top / Left / Right / Back leave.
 */
import { registerKeyHandler } from '../input/handler.js';

var LABEL_RE = /^(Auto|4K|Full HD|HD|SD|Data Saver)$/i;
var active = false;
var idx = 0;
var lastRow = null;

function isHotstar() {
  try { return /(^|\.)(hotstar|jiohotstar)\.com$/i.test(window.location.hostname); } catch (e) { return false; }
}

function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  var n = el;
  while (n && n.nodeType === 1) {
    var cs = window.getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    n = n.parentElement;
  }
  return true;
}

function labelLeaves() {
  var out = [];
  var all = document.body ? document.body.getElementsByTagName('*') : [];
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    if (el.children.length) continue;
    var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (LABEL_RE.test(t) && visible(el)) out.push({ el: el, text: t });
  }
  return out;
}

function ancestors(el) {
  var a = [];
  while (el) { a.push(el); el = el.parentElement; }
  return a;
}

function lca(a, b) {
  var pa = ancestors(a);
  var n = b;
  while (n) { if (pa.indexOf(n) !== -1) return n; n = n.parentElement; }
  return null;
}

function rowFor(leaf, list) {
  var n = leaf;
  while (n && n.parentElement && n.parentElement !== list) n = n.parentElement;
  return n;
}

function findOptions() {
  var leaves = labelLeaves();
  var anchor = null, other = null;
  for (var i = 0; i < leaves.length; i++) {
    if (/^Data Saver$/i.test(leaves[i].text)) anchor = leaves[i].el;
  }
  for (var j = 0; j < leaves.length; j++) {
    if (/^(Full HD|HD)$/i.test(leaves[j].text) && leaves[j].el !== anchor) { other = leaves[j].el; if (anchor) break; }
  }
  if (!anchor) {
    for (var k = 0; k < leaves.length; k++) {
      if (/^Full HD$/i.test(leaves[k].text)) anchor = leaves[k].el;
      else if (/^HD$/i.test(leaves[k].text)) other = leaves[k].el;
    }
  }
  if (!anchor || !other) return null;
  var list = lca(anchor, other);
  if (!list) return null;
  var opts = [];
  for (var m = 0; m < leaves.length; m++) {
    var lf = leaves[m].el;
    if (lf !== list && list.contains(lf)) {
      var row = rowFor(lf, list);
      var dup = false;
      for (var q = 0; q < opts.length; q++) if (opts[q].row === row) dup = true;
      if (!dup) opts.push({ leaf: lf, row: row, text: leaves[m].text });
    }
  }
  opts.sort(function (a, b) { return a.row.getBoundingClientRect().top - b.row.getBoundingClientRect().top; });
  return opts.length >= 2 ? opts : null;
}

function paint(opts) {
  if (lastRow) { lastRow.style.outline = ''; lastRow.style.outlineOffset = ''; }
  lastRow = null;
  if (!opts || !active) return;
  var r = opts[idx].row;
  r.style.outline = '3px solid #00b4ff';
  r.style.outlineOffset = '2px';
  lastRow = r;
}

function fire(el) {
  var r = el.getBoundingClientRect();
  var x = r.left + r.width / 2, y = r.top + r.height / 2;
  var base = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 };
  var seq = ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
  for (var i = 0; i < seq.length; i++) {
    var type = seq[i], ev;
    try {
      if (type.indexOf('pointer') === 0 && typeof window.PointerEvent === 'function') {
        ev = new PointerEvent(type, Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true }, base));
      } else {
        ev = new MouseEvent(type, base);
      }
      el.dispatchEvent(ev);
    } catch (e) {}
  }
}

function leave(opts) { active = false; paint(opts); }

function onKey(event) {
  var k = event.keyCode;
  if (k !== 37 && k !== 38 && k !== 39 && k !== 40 && k !== 13 && k !== 10009 && k !== 27) return false;
  var opts = findOptions();
  if (!opts) { if (active) leave(null); return false; }
  if (!active) {
    if (k !== 40) return false;
    active = true;
    idx = 0;
    paint(opts);
    return true;
  }
  if (idx >= opts.length) idx = opts.length - 1;
  if (k === 40) { if (idx < opts.length - 1) idx++; paint(opts); return true; }
  if (k === 38) {
    if (idx === 0) { leave(opts); return false; }
    idx--; paint(opts); return true;
  }
  if (k === 13) {
    var o = opts[idx];
    console.log('TizenPortal [shai]: Hotstar menu select ' + o.text);
    fire(o.leaf);
    leave(opts);
    return true;
  }
  leave(opts);
  return false;
}

export function initHotstarMenu() {
  if (!isHotstar()) return;
  registerKeyHandler(onKey);
}
