/* eslint-disable */
/*! highlight.js v9.12.0 | BSD3 License | git.io/hljslicense */
!(function(e) {
  var t =
    ('object' == typeof window && window) || ('object' == typeof self && self);
  'undefined' != typeof exports
    ? e(exports)
    : t &&
      ((t.hljs = e({})),
      'function' == typeof define &&
        define.amd &&
        define([], function() {
          return t.hljs;
        }));
})(function(e) {
  function t(e) {
    return e
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function r(e) {
    return e.nodeName.toLowerCase();
  }
  function n(e, t) {
    var r = e && e.exec(t);
    return r && 0 === r.index;
  }
  function a(e) {
    return M.test(e);
  }
  function i(e) {
    var t,
      r,
      n,
      i,
      o = e.className + ' ';
    if (((o += e.parentNode ? e.parentNode.className : ''), (r = R.exec(o))))
      return N(r[1]) ? r[1] : 'no-highlight';
    for (o = o.split(/\s+/), t = 0, n = o.length; n > t; t++)
      if (((i = o[t]), a(i) || N(i))) return i;
  }
  function o(e) {
    var t,
      r = {},
      n = Array.prototype.slice.call(arguments, 1);
    for (t in e) r[t] = e[t];
    return (
      n.forEach(function(e) {
        for (t in e) r[t] = e[t];
      }),
      r
    );
  }
  function s(e) {
    var t = [];
    return (
      (function n(e, a) {
        for (var i = e.firstChild; i; i = i.nextSibling)
          3 === i.nodeType
            ? (a += i.nodeValue.length)
            : 1 === i.nodeType &&
              (t.push({ event: 'start', offset: a, node: i }),
              (a = n(i, a)),
              r(i).match(/br|hr|img|input/) ||
                t.push({ event: 'stop', offset: a, node: i }));
        return a;
      })(e, 0),
      t
    );
  }
  function c(e, n, a) {
    function i() {
      return e.length && n.length
        ? e[0].offset !== n[0].offset
          ? e[0].offset < n[0].offset
            ? e
            : n
          : 'start' === n[0].event
            ? e
            : n
        : e.length
          ? e
          : n;
    }
    function o(e) {
      function n(e) {
        return (
          ' ' + e.nodeName + '="' + t(e.value).replace('"', '&quot;') + '"'
        );
      }
      u += '<' + r(e) + k.map.call(e.attributes, n).join('') + '>';
    }
    function s(e) {
      u += '</' + r(e) + '>';
    }
    function c(e) {
      ('start' === e.event ? o : s)(e.node);
    }
    for (var l = 0, u = '', b = []; e.length || n.length; ) {
      var d = i();
      if (((u += t(a.substring(l, d[0].offset))), (l = d[0].offset), d === e)) {
        b.reverse().forEach(s);
        do c(d.splice(0, 1)[0]), (d = i());
        while (d === e && d.length && d[0].offset === l);
        b.reverse().forEach(o);
      } else
        'start' === d[0].event ? b.push(d[0].node) : b.pop(),
          c(d.splice(0, 1)[0]);
    }
    return u + t(a.substr(l));
  }
  function l(e) {
    return (
      e.v &&
        !e.cached_variants &&
        (e.cached_variants = e.v.map(function(t) {
          return o(e, { v: null }, t);
        })),
      e.cached_variants || (e.eW && [o(e)]) || [e]
    );
  }
  function u(e) {
    function t(e) {
      return (e && e.source) || e;
    }
    function r(r, n) {
      return new RegExp(t(r), 'm' + (e.cI ? 'i' : '') + (n ? 'g' : ''));
    }
    function n(a, i) {
      if (!a.compiled) {
        if (((a.compiled = !0), (a.k = a.k || a.bK), a.k)) {
          var o = {},
            s = function(t, r) {
              e.cI && (r = r.toLowerCase()),
                r.split(' ').forEach(function(e) {
                  var r = e.split('|');
                  o[r[0]] = [t, r[1] ? Number(r[1]) : 1];
                });
            };
          'string' == typeof a.k
            ? s('keyword', a.k)
            : x(a.k).forEach(function(e) {
                s(e, a.k[e]);
              }),
            (a.k = o);
        }
        (a.lR = r(a.l || /\w+/, !0)),
          i &&
            (a.bK && (a.b = '\\b(' + a.bK.split(' ').join('|') + ')\\b'),
            a.b || (a.b = /\B|\b/),
            (a.bR = r(a.b)),
            a.e || a.eW || (a.e = /\B|\b/),
            a.e && (a.eR = r(a.e)),
            (a.tE = t(a.e) || ''),
            a.eW && i.tE && (a.tE += (a.e ? '|' : '') + i.tE)),
          a.i && (a.iR = r(a.i)),
          null == a.r && (a.r = 1),
          a.c || (a.c = []),
          (a.c = Array.prototype.concat.apply(
            [],
            a.c.map(function(e) {
              return l('self' === e ? a : e);
            })
          )),
          a.c.forEach(function(e) {
            n(e, a);
          }),
          a.starts && n(a.starts, i);
        var c = a.c
          .map(function(e) {
            return e.bK ? '\\.?(' + e.b + ')\\.?' : e.b;
          })
          .concat([a.tE, a.i])
          .map(t)
          .filter(Boolean);
        a.t = c.length
          ? r(c.join('|'), !0)
          : {
              exec: function() {
                return null;
              },
            };
      }
    }
    n(e);
  }
  function b(e, r, a, i) {
    function o(e, t) {
      var r, a;
      for (r = 0, a = t.c.length; a > r; r++)
        if (n(t.c[r].bR, e)) return t.c[r];
    }
    function s(e, t) {
      if (n(e.eR, t)) {
        for (; e.endsParent && e.parent; ) e = e.parent;
        return e;
      }
      return e.eW ? s(e.parent, t) : void 0;
    }
    function c(e, t) {
      return !a && n(t.iR, e);
    }
    function l(e, t) {
      var r = w.cI ? t[0].toLowerCase() : t[0];
      return e.k.hasOwnProperty(r) && e.k[r];
    }
    function p(e, t, r, n) {
      var a = n ? '' : z.classPrefix,
        i = '<span class="' + a,
        o = r ? '' : B;
      return (i += e + '">'), i + t + o;
    }
    function f() {
      var e, r, n, a;
      if (!k.k) return t(M);
      for (a = '', r = 0, k.lR.lastIndex = 0, n = k.lR.exec(M); n; )
        (a += t(M.substring(r, n.index))),
          (e = l(k, n)),
          e ? ((R += e[1]), (a += p(e[0], t(n[0])))) : (a += t(n[0])),
          (r = k.lR.lastIndex),
          (n = k.lR.exec(M));
      return a + t(M.substr(r));
    }
    function g() {
      var e = 'string' == typeof k.sL;
      if (e && !E[k.sL]) return t(M);
      var r = e ? b(k.sL, M, !0, x[k.sL]) : d(M, k.sL.length ? k.sL : void 0);
      return (
        k.r > 0 && (R += r.r),
        e && (x[k.sL] = r.top),
        p(r.language, r.value, !1, !0)
      );
    }
    function m() {
      (C += null != k.sL ? g() : f()), (M = '');
    }
    function h(e) {
      (C += e.cN ? p(e.cN, '', !0) : ''),
        (k = Object.create(e, { parent: { value: k } }));
    }
    function v(e, t) {
      if (((M += e), null == t)) return m(), 0;
      var r = o(t, k);
      if (r)
        return (
          r.skip ? (M += t) : (r.eB && (M += t), m(), r.rB || r.eB || (M = t)),
          h(r, t),
          r.rB ? 0 : t.length
        );
      var n = s(k, t);
      if (n) {
        var a = k;
        a.skip ? (M += t) : (a.rE || a.eE || (M += t), m(), a.eE && (M = t));
        do k.cN && (C += B), k.skip || k.sL || (R += k.r), (k = k.parent);
        while (k !== n.parent);
        return n.starts && h(n.starts, ''), a.rE ? 0 : t.length;
      }
      if (c(t, k))
        throw new Error(
          'Illegal lexeme "' + t + '" for mode "' + (k.cN || '<unnamed>') + '"'
        );
      return (M += t), t.length || 1;
    }
    var w = N(e);
    if (!w) throw new Error('Unknown language: "' + e + '"');
    u(w);
    var y,
      k = i || w,
      x = {},
      C = '';
    for (y = k; y !== w; y = y.parent) y.cN && (C = p(y.cN, '', !0) + C);
    var M = '',
      R = 0;
    try {
      for (var A, S, L = 0; ; ) {
        if (((k.t.lastIndex = L), (A = k.t.exec(r)), !A)) break;
        (S = v(r.substring(L, A.index), A[0])), (L = A.index + S);
      }
      for (v(r.substr(L)), y = k; y.parent; y = y.parent) y.cN && (C += B);
      return { r: R, value: C, language: e, top: k };
    } catch (I) {
      if (I.message && -1 !== I.message.indexOf('Illegal'))
        return { r: 0, value: t(r) };
      throw I;
    }
  }
  function d(e, r) {
    r = r || z.languages || x(E);
    var n = { r: 0, value: t(e) },
      a = n;
    return (
      r.filter(N).forEach(function(t) {
        var r = b(t, e, !1);
        (r.language = t), r.r > a.r && (a = r), r.r > n.r && ((a = n), (n = r));
      }),
      a.language && (n.second_best = a),
      n
    );
  }
  function p(e) {
    return z.tabReplace || z.useBR
      ? e.replace(A, function(e, t) {
          return z.useBR && '\n' === e
            ? '<br>'
            : z.tabReplace
              ? t.replace(/\t/g, z.tabReplace)
              : '';
        })
      : e;
  }
  function f(e, t, r) {
    var n = t ? C[t] : r,
      a = [e.trim()];
    return (
      e.match(/\bhljs\b/) || a.push('hljs'),
      -1 === e.indexOf(n) && a.push(n),
      a.join(' ').trim()
    );
  }
  function g(e) {
    var t,
      r,
      n,
      o,
      l,
      u = i(e);
    a(u) ||
      (z.useBR
        ? ((t = document.createElementNS(
            'http://www.w3.org/1999/xhtml',
            'div'
          )),
          (t.innerHTML = e.innerHTML
            .replace(/\n/g, '')
            .replace(/<br[ \/]*>/g, '\n')))
        : (t = e),
      (l = t.textContent),
      (n = u ? b(u, l, !0) : d(l)),
      (r = s(t)),
      r.length &&
        ((o = document.createElementNS('http://www.w3.org/1999/xhtml', 'div')),
        (o.innerHTML = n.value),
        (n.value = c(r, s(o), l))),
      (n.value = p(n.value)),
      (e.innerHTML = n.value),
      (e.className = f(e.className, u, n.language)),
      (e.result = { language: n.language, re: n.r }),
      n.second_best &&
        (e.second_best = {
          language: n.second_best.language,
          re: n.second_best.r,
        }));
  }
  function m(e) {
    z = o(z, e);
  }
  function h() {
    if (!h.called) {
      h.called = !0;
      var e = document.querySelectorAll('pre code');
      k.forEach.call(e, g);
    }
  }
  function v() {
    addEventListener('DOMContentLoaded', h, !1),
      addEventListener('load', h, !1);
  }
  function w(t, r) {
    var n = (E[t] = r(e));
    n.aliases &&
      n.aliases.forEach(function(e) {
        C[e] = t;
      });
  }
  function y() {
    return x(E);
  }
  function N(e) {
    return (e = (e || '').toLowerCase()), E[e] || E[C[e]];
  }
  var k = [],
    x = Object.keys,
    E = {},
    C = {},
    M = /^(no-?highlight|plain|text)$/i,
    R = /\blang(?:uage)?-([\w-]+)\b/i,
    A = /((^(<[^>]+>|\t|)+|(?:\n)))/gm,
    B = '</span>',
    z = {
      classPrefix: 'hljs-',
      tabReplace: null,
      useBR: !1,
      languages: void 0,
    };
  return (
    (e.highlight = b),
    (e.highlightAuto = d),
    (e.fixMarkup = p),
    (e.highlightBlock = g),
    (e.configure = m),
    (e.initHighlighting = h),
    (e.initHighlightingOnLoad = v),
    (e.registerLanguage = w),
    (e.listLanguages = y),
    (e.getLanguage = N),
    (e.inherit = o),
    (e.IR = '[a-zA-Z]\\w*'),
    (e.UIR = '[a-zA-Z_]\\w*'),
    (e.NR = '\\b\\d+(\\.\\d+)?'),
    (e.CNR =
      '(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)'),
    (e.BNR = '\\b(0b[01]+)'),
    (e.RSR =
      '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~'),
    (e.BE = { b: '\\\\[\\s\\S]', r: 0 }),
    (e.ASM = { cN: 'string', b: "'", e: "'", i: '\\n', c: [e.BE] }),
    (e.QSM = { cN: 'string', b: '"', e: '"', i: '\\n', c: [e.BE] }),
    (e.PWM = {
      b: /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/,
    }),
    (e.C = function(t, r, n) {
      var a = e.inherit({ cN: 'comment', b: t, e: r, c: [] }, n || {});
      return (
        a.c.push(e.PWM),
        a.c.push({ cN: 'doctag', b: '(?:TODO|FIXME|NOTE|BUG|XXX):', r: 0 }),
        a
      );
    }),
    (e.CLCM = e.C('//', '$')),
    (e.CBCM = e.C('/\\*', '\\*/')),
    (e.HCM = e.C('#', '$')),
    (e.NM = { cN: 'number', b: e.NR, r: 0 }),
    (e.CNM = { cN: 'number', b: e.CNR, r: 0 }),
    (e.BNM = { cN: 'number', b: e.BNR, r: 0 }),
    (e.CSSNM = {
      cN: 'number',
      b:
        e.NR +
        '(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?',
      r: 0,
    }),
    (e.RM = {
      cN: 'regexp',
      b: /\//,
      e: /\/[gimuy]*/,
      i: /\n/,
      c: [e.BE, { b: /\[/, e: /\]/, r: 0, c: [e.BE] }],
    }),
    (e.TM = { cN: 'title', b: e.IR, r: 0 }),
    (e.UTM = { cN: 'title', b: e.UIR, r: 0 }),
    (e.METHOD_GUARD = { b: '\\.\\s*' + e.UIR, r: 0 }),
    e.registerLanguage('bash', function(e) {
      var t = {
          cN: 'variable',
          v: [{ b: /\$[\w\d#@][\w\d_]*/ }, { b: /\$\{(.*?)}/ }],
        },
        r = {
          cN: 'string',
          b: /"/,
          e: /"/,
          c: [e.BE, t, { cN: 'variable', b: /\$\(/, e: /\)/, c: [e.BE] }],
        },
        n = { cN: 'string', b: /'/, e: /'/ };
      return {
        aliases: ['sh', 'zsh'],
        l: /\b-?[a-z\._]+\b/,
        k: {
          keyword:
            'if then else elif fi for while in do done case esac function',
          literal: 'true false',
          built_in:
            'break cd continue eval exec exit export getopts hash pwd readonly return shift test times trap umask unset alias bind builtin caller command declare echo enable help let local logout mapfile printf read readarray source type typeset ulimit unalias set shopt autoload bg bindkey bye cap chdir clone comparguments compcall compctl compdescribe compfiles compgroups compquote comptags comptry compvalues dirs disable disown echotc echoti emulate fc fg float functions getcap getln history integer jobs kill limit log noglob popd print pushd pushln rehash sched setcap setopt stat suspend ttyctl unfunction unhash unlimit unsetopt vared wait whence where which zcompile zformat zftp zle zmodload zparseopts zprof zpty zregexparse zsocket zstyle ztcp',
          _: '-ne -eq -lt -gt -f -d -e -s -l -a',
        },
        c: [
          { cN: 'meta', b: /^#![^\n]+sh\s*$/, r: 10 },
          {
            cN: 'function',
            b: /\w[\w\d_]*\s*\(\s*\)\s*\{/,
            rB: !0,
            c: [e.inherit(e.TM, { b: /\w[\w\d_]*/ })],
            r: 0,
          },
          e.HCM,
          r,
          n,
          t,
        ],
      };
    }),
    e.registerLanguage('css', function(e) {
      var t = '[a-zA-Z-][a-zA-Z0-9_-]*',
        r = {
          b: /[A-Z\_\.\-]+\s*:/,
          rB: !0,
          e: ';',
          eW: !0,
          c: [
            {
              cN: 'attribute',
              b: /\S/,
              e: ':',
              eE: !0,
              starts: {
                eW: !0,
                eE: !0,
                c: [
                  {
                    b: /[\w-]+\(/,
                    rB: !0,
                    c: [
                      { cN: 'built_in', b: /[\w-]+/ },
                      { b: /\(/, e: /\)/, c: [e.ASM, e.QSM] },
                    ],
                  },
                  e.CSSNM,
                  e.QSM,
                  e.ASM,
                  e.CBCM,
                  { cN: 'number', b: '#[0-9A-Fa-f]+' },
                  { cN: 'meta', b: '!important' },
                ],
              },
            },
          ],
        };
      return {
        cI: !0,
        i: /[=\/|'\$]/,
        c: [
          e.CBCM,
          { cN: 'selector-id', b: /#[A-Za-z0-9_-]+/ },
          { cN: 'selector-class', b: /\.[A-Za-z0-9_-]+/ },
          { cN: 'selector-attr', b: /\[/, e: /\]/, i: '$' },
          { cN: 'selector-pseudo', b: /:(:)?[a-zA-Z0-9\_\-\+\(\)"'.]+/ },
          { b: '@(font-face|page)', l: '[a-z-]+', k: 'font-face page' },
          {
            b: '@',
            e: '[{;]',
            i: /:/,
            c: [
              { cN: 'keyword', b: /\w+/ },
              { b: /\s/, eW: !0, eE: !0, r: 0, c: [e.ASM, e.QSM, e.CSSNM] },
            ],
          },
          { cN: 'selector-tag', b: t, r: 0 },
          { b: '{', e: '}', i: /\S/, c: [e.CBCM, r] },
        ],
      };
    }),
    e.registerLanguage('javascript', function(e) {
      var t = '[A-Za-z$_][0-9A-Za-z$_]*',
        r = {
          keyword:
            'in of if for while finally var new function do return void else break catch instanceof with throw case default try this switch continue typeof delete let yield const export super debugger as async await static import from as',
          literal: 'true false null undefined NaN Infinity',
          built_in:
            'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape Object Function Boolean Error EvalError InternalError RangeError ReferenceError StopIteration SyntaxError TypeError URIError Number Math Date String RegExp Array Float32Array Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require module console window document Symbol Set Map WeakSet WeakMap Proxy Reflect Promise',
        },
        n = {
          cN: 'number',
          v: [
            { b: '\\b(0[bB][01]+)' },
            { b: '\\b(0[oO][0-7]+)' },
            { b: e.CNR },
          ],
          r: 0,
        },
        a = { cN: 'subst', b: '\\$\\{', e: '\\}', k: r, c: [] },
        i = { cN: 'string', b: '`', e: '`', c: [e.BE, a] };
      a.c = [e.ASM, e.QSM, i, n, e.RM];
      var o = a.c.concat([e.CBCM, e.CLCM]);
      return {
        aliases: ['js', 'jsx'],
        k: r,
        c: [
          { cN: 'meta', r: 10, b: /^\s*['"]use (strict|asm)['"]/ },
          { cN: 'meta', b: /^#!/, e: /$/ },
          e.ASM,
          e.QSM,
          i,
          e.CLCM,
          e.CBCM,
          n,
          {
            b: /[{,]\s*/,
            r: 0,
            c: [
              { b: t + '\\s*:', rB: !0, r: 0, c: [{ cN: 'attr', b: t, r: 0 }] },
            ],
          },
          {
            b: '(' + e.RSR + '|\\b(case|return|throw)\\b)\\s*',
            k: 'return throw case',
            c: [
              e.CLCM,
              e.CBCM,
              e.RM,
              {
                cN: 'function',
                b: '(\\(.*?\\)|' + t + ')\\s*=>',
                rB: !0,
                e: '\\s*=>',
                c: [
                  {
                    cN: 'params',
                    v: [
                      { b: t },
                      { b: /\(\s*\)/ },
                      { b: /\(/, e: /\)/, eB: !0, eE: !0, k: r, c: o },
                    ],
                  },
                ],
              },
              {
                b: /</,
                e: /(\/\w+|\w+\/)>/,
                sL: 'xml',
                c: [
                  { b: /<\w+\s*\/>/, skip: !0 },
                  {
                    b: /<\w+/,
                    e: /(\/\w+|\w+\/)>/,
                    skip: !0,
                    c: [{ b: /<\w+\s*\/>/, skip: !0 }, 'self'],
                  },
                ],
              },
            ],
            r: 0,
          },
          {
            cN: 'function',
            bK: 'function',
            e: /\{/,
            eE: !0,
            c: [
              e.inherit(e.TM, { b: t }),
              { cN: 'params', b: /\(/, e: /\)/, eB: !0, eE: !0, c: o },
            ],
            i: /\[|%/,
          },
          { b: /\$[(.]/ },
          e.METHOD_GUARD,
          {
            cN: 'class',
            bK: 'class',
            e: /[{;=]/,
            eE: !0,
            i: /[:"\[\]]/,
            c: [{ bK: 'extends' }, e.UTM],
          },
          { bK: 'constructor', e: /\{/, eE: !0 },
        ],
        i: /#(?!!)/,
      };
    }),
    e.registerLanguage('xml', function(e) {
      var t = '[A-Za-z0-9\\._:-]+',
        r = {
          eW: !0,
          i: /</,
          r: 0,
          c: [
            { cN: 'attr', b: t, r: 0 },
            {
              b: /=\s*/,
              r: 0,
              c: [
                {
                  cN: 'string',
                  endsParent: !0,
                  v: [
                    { b: /"/, e: /"/ },
                    { b: /'/, e: /'/ },
                    { b: /[^\s"'=<>`]+/ },
                  ],
                },
              ],
            },
          ],
        };
      return {
        aliases: ['html', 'xhtml', 'rss', 'atom', 'xjb', 'xsd', 'xsl', 'plist'],
        cI: !0,
        c: [
          {
            cN: 'meta',
            b: '<!DOCTYPE',
            e: '>',
            r: 10,
            c: [{ b: '\\[', e: '\\]' }],
          },
          e.C('<!--', '-->', { r: 10 }),
          { b: '<\\!\\[CDATA\\[', e: '\\]\\]>', r: 10 },
          { cN: 'meta', b: /<\?xml/, e: /\?>/, r: 10 },
          {
            b: /<\?(php)?/,
            e: /\?>/,
            sL: 'php',
            c: [{ b: '/\\*', e: '\\*/', skip: !0 }],
          },
          {
            cN: 'tag',
            b: '<style(?=\\s|>|$)',
            e: '>',
            k: { name: 'style' },
            c: [r],
            starts: { e: '</style>', rE: !0, sL: ['css', 'xml'] },
          },
          {
            cN: 'tag',
            b: '<script(?=\\s|>|$)',
            e: '>',
            k: { name: 'script' },
            c: [r],
            starts: {
              e: '</script>',
              rE: !0,
              sL: ['actionscript', 'javascript', 'handlebars', 'xml'],
            },
          },
          {
            cN: 'tag',
            b: '</?',
            e: '/?>',
            c: [{ cN: 'name', b: /[^\/><\s]+/, r: 0 }, r],
          },
        ],
      };
    }),
    e.registerLanguage('markdown', function(e) {
      return {
        aliases: ['md', 'mkdown', 'mkd'],
        c: [
          {
            cN: 'section',
            v: [{ b: '^#{1,6}', e: '$' }, { b: '^.+?\\n[=-]{2,}$' }],
          },
          { b: '<', e: '>', sL: 'xml', r: 0 },
          { cN: 'bullet', b: '^([*+-]|(\\d+\\.))\\s+' },
          { cN: 'strong', b: '[*_]{2}.+?[*_]{2}' },
          { cN: 'emphasis', v: [{ b: '\\*.+?\\*' }, { b: '_.+?_', r: 0 }] },
          { cN: 'quote', b: '^>\\s+', e: '$' },
          {
            cN: 'code',
            v: [
              { b: '^```w*s*$', e: '^```s*$' },
              { b: '`.+?`' },
              { b: '^( {4}|	)', e: '$', r: 0 },
            ],
          },
          { b: '^[-\\*]{3,}', e: '$' },
          {
            b: '\\[.+?\\][\\(\\[].*?[\\)\\]]',
            rB: !0,
            c: [
              { cN: 'string', b: '\\[', e: '\\]', eB: !0, rE: !0, r: 0 },
              { cN: 'link', b: '\\]\\(', e: '\\)', eB: !0, eE: !0 },
              { cN: 'symbol', b: '\\]\\[', e: '\\]', eB: !0, eE: !0 },
            ],
            r: 10,
          },
          {
            b: /^\[[^\n]+\]:/,
            rB: !0,
            c: [
              { cN: 'symbol', b: /\[/, e: /\]/, eB: !0, eE: !0 },
              { cN: 'link', b: /:\s*/, e: /$/, eB: !0 },
            ],
          },
        ],
      };
    }),
    e.registerLanguage('scss', function(e) {
      var t = '[a-zA-Z-][a-zA-Z0-9_-]*',
        r = { cN: 'variable', b: '(\\$' + t + ')\\b' },
        n = { cN: 'number', b: '#[0-9A-Fa-f]+' };
      ({
        cN: 'attribute',
        b: '[A-Z\\_\\.\\-]+',
        e: ':',
        eE: !0,
        i: '[^\\s]',
        starts: {
          eW: !0,
          eE: !0,
          c: [
            n,
            e.CSSNM,
            e.QSM,
            e.ASM,
            e.CBCM,
            { cN: 'meta', b: '!important' },
          ],
        },
      });
      return {
        cI: !0,
        i: "[=/|']",
        c: [
          e.CLCM,
          e.CBCM,
          { cN: 'selector-id', b: '\\#[A-Za-z0-9_-]+', r: 0 },
          { cN: 'selector-class', b: '\\.[A-Za-z0-9_-]+', r: 0 },
          { cN: 'selector-attr', b: '\\[', e: '\\]', i: '$' },
          {
            cN: 'selector-tag',
            b:
              '\\b(a|abbr|acronym|address|area|article|aside|audio|b|base|big|blockquote|body|br|button|canvas|caption|cite|code|col|colgroup|command|datalist|dd|del|details|dfn|div|dl|dt|em|embed|fieldset|figcaption|figure|footer|form|frame|frameset|(h[1-6])|head|header|hgroup|hr|html|i|iframe|img|input|ins|kbd|keygen|label|legend|li|link|map|mark|meta|meter|nav|noframes|noscript|object|ol|optgroup|option|output|p|param|pre|progress|q|rp|rt|ruby|samp|script|section|select|small|span|strike|strong|style|sub|sup|table|tbody|td|textarea|tfoot|th|thead|time|title|tr|tt|ul|var|video)\\b',
            r: 0,
          },
          {
            b:
              ':(visited|valid|root|right|required|read-write|read-only|out-range|optional|only-of-type|only-child|nth-of-type|nth-last-of-type|nth-last-child|nth-child|not|link|left|last-of-type|last-child|lang|invalid|indeterminate|in-range|hover|focus|first-of-type|first-line|first-letter|first-child|first|enabled|empty|disabled|default|checked|before|after|active)',
          },
          {
            b:
              '::(after|before|choices|first-letter|first-line|repeat-index|repeat-item|selection|value)',
          },
          r,
          {
            cN: 'attribute',
            b:
              '\\b(z-index|word-wrap|word-spacing|word-break|width|widows|white-space|visibility|vertical-align|unicode-bidi|transition-timing-function|transition-property|transition-duration|transition-delay|transition|transform-style|transform-origin|transform|top|text-underline-position|text-transform|text-shadow|text-rendering|text-overflow|text-indent|text-decoration-style|text-decoration-line|text-decoration-color|text-decoration|text-align-last|text-align|tab-size|table-layout|right|resize|quotes|position|pointer-events|perspective-origin|perspective|page-break-inside|page-break-before|page-break-after|padding-top|padding-right|padding-left|padding-bottom|padding|overflow-y|overflow-x|overflow-wrap|overflow|outline-width|outline-style|outline-offset|outline-color|outline|orphans|order|opacity|object-position|object-fit|normal|none|nav-up|nav-right|nav-left|nav-index|nav-down|min-width|min-height|max-width|max-height|mask|marks|margin-top|margin-right|margin-left|margin-bottom|margin|list-style-type|list-style-position|list-style-image|list-style|line-height|letter-spacing|left|justify-content|initial|inherit|ime-mode|image-orientation|image-resolution|image-rendering|icon|hyphens|height|font-weight|font-variant-ligatures|font-variant|font-style|font-stretch|font-size-adjust|font-size|font-language-override|font-kerning|font-feature-settings|font-family|font|float|flex-wrap|flex-shrink|flex-grow|flex-flow|flex-direction|flex-basis|flex|filter|empty-cells|display|direction|cursor|counter-reset|counter-increment|content|column-width|column-span|column-rule-width|column-rule-style|column-rule-color|column-rule|column-gap|column-fill|column-count|columns|color|clip-path|clip|clear|caption-side|break-inside|break-before|break-after|box-sizing|box-shadow|box-decoration-break|bottom|border-width|border-top-width|border-top-style|border-top-right-radius|border-top-left-radius|border-top-color|border-top|border-style|border-spacing|border-right-width|border-right-style|border-right-color|border-right|border-radius|border-left-width|border-left-style|border-left-color|border-left|border-image-width|border-image-source|border-image-slice|border-image-repeat|border-image-outset|border-image|border-color|border-collapse|border-bottom-width|border-bottom-style|border-bottom-right-radius|border-bottom-left-radius|border-bottom-color|border-bottom|border|background-size|background-repeat|background-position|background-origin|background-image|background-color|background-clip|background-attachment|background-blend-mode|background|backface-visibility|auto|animation-timing-function|animation-play-state|animation-name|animation-iteration-count|animation-fill-mode|animation-duration|animation-direction|animation-delay|animation|align-self|align-items|align-content)\\b',
            i: '[^\\s]',
          },
          {
            b:
              '\\b(whitespace|wait|w-resize|visible|vertical-text|vertical-ideographic|uppercase|upper-roman|upper-alpha|underline|transparent|top|thin|thick|text|text-top|text-bottom|tb-rl|table-header-group|table-footer-group|sw-resize|super|strict|static|square|solid|small-caps|separate|se-resize|scroll|s-resize|rtl|row-resize|ridge|right|repeat|repeat-y|repeat-x|relative|progress|pointer|overline|outside|outset|oblique|nowrap|not-allowed|normal|none|nw-resize|no-repeat|no-drop|newspaper|ne-resize|n-resize|move|middle|medium|ltr|lr-tb|lowercase|lower-roman|lower-alpha|loose|list-item|line|line-through|line-edge|lighter|left|keep-all|justify|italic|inter-word|inter-ideograph|inside|inset|inline|inline-block|inherit|inactive|ideograph-space|ideograph-parenthesis|ideograph-numeric|ideograph-alpha|horizontal|hidden|help|hand|groove|fixed|ellipsis|e-resize|double|dotted|distribute|distribute-space|distribute-letter|distribute-all-lines|disc|disabled|default|decimal|dashed|crosshair|collapse|col-resize|circle|char|center|capitalize|break-word|break-all|bottom|both|bolder|bold|block|bidi-override|below|baseline|auto|always|all-scroll|absolute|table|table-cell)\\b',
          },
          {
            b: ':',
            e: ';',
            c: [r, n, e.CSSNM, e.QSM, e.ASM, { cN: 'meta', b: '!important' }],
          },
          {
            b: '@',
            e: '[{;]',
            k:
              'mixin include extend for if else each while charset import debug media page content font-face namespace warn',
            c: [r, e.QSM, e.ASM, n, e.CSSNM, { b: '\\s[A-Za-z0-9_.-]+', r: 0 }],
          },
        ],
      };
    }),
    e.registerLanguage('shell', function(e) {
      return {
        aliases: ['console'],
        c: [
          {
            cN: 'meta',
            b: '^\\s{0,3}[\\w\\d\\[\\]()@-]*[>%$#]',
            starts: { e: '$', sL: 'bash' },
          },
        ],
      };
    }),
    e.registerLanguage('typescript', function(e) {
      var t = {
        keyword:
          'in if for while finally var new function do return void else break catch instanceof with throw case default try this switch continue typeof delete let yield const class public private protected get set super static implements enum export import declare type namespace abstract as from extends async await',
        literal: 'true false null undefined NaN Infinity',
        built_in:
          'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape Object Function Boolean Error EvalError InternalError RangeError ReferenceError StopIteration SyntaxError TypeError URIError Number Math Date String RegExp Array Float32Array Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require module console window document any number boolean string void Promise',
      };
      return {
        aliases: ['ts'],
        k: t,
        c: [
          { cN: 'meta', b: /^\s*['"]use strict['"]/ },
          e.ASM,
          e.QSM,
          {
            cN: 'string',
            b: '`',
            e: '`',
            c: [e.BE, { cN: 'subst', b: '\\$\\{', e: '\\}' }],
          },
          e.CLCM,
          e.CBCM,
          {
            cN: 'number',
            v: [
              { b: '\\b(0[bB][01]+)' },
              { b: '\\b(0[oO][0-7]+)' },
              { b: e.CNR },
            ],
            r: 0,
          },
          {
            b: '(' + e.RSR + '|\\b(case|return|throw)\\b)\\s*',
            k: 'return throw case',
            c: [
              e.CLCM,
              e.CBCM,
              e.RM,
              {
                cN: 'function',
                b: '(\\(.*?\\)|' + e.IR + ')\\s*=>',
                rB: !0,
                e: '\\s*=>',
                c: [
                  {
                    cN: 'params',
                    v: [
                      { b: e.IR },
                      { b: /\(\s*\)/ },
                      {
                        b: /\(/,
                        e: /\)/,
                        eB: !0,
                        eE: !0,
                        k: t,
                        c: ['self', e.CLCM, e.CBCM],
                      },
                    ],
                  },
                ],
              },
            ],
            r: 0,
          },
          {
            cN: 'function',
            b: 'function',
            e: /[\{;]/,
            eE: !0,
            k: t,
            c: [
              'self',
              e.inherit(e.TM, { b: /[A-Za-z$_][0-9A-Za-z$_]*/ }),
              {
                cN: 'params',
                b: /\(/,
                e: /\)/,
                eB: !0,
                eE: !0,
                k: t,
                c: [e.CLCM, e.CBCM],
                i: /["'\(]/,
              },
            ],
            i: /%/,
            r: 0,
          },
          {
            bK: 'constructor',
            e: /\{/,
            eE: !0,
            c: [
              'self',
              {
                cN: 'params',
                b: /\(/,
                e: /\)/,
                eB: !0,
                eE: !0,
                k: t,
                c: [e.CLCM, e.CBCM],
                i: /["'\(]/,
              },
            ],
          },
          { b: /module\./, k: { built_in: 'module' }, r: 0 },
          { bK: 'module', e: /\{/, eE: !0 },
          { bK: 'interface', e: /\{/, eE: !0, k: 'interface extends' },
          { b: /\$[(.]/ },
          { b: '\\.' + e.IR, r: 0 },
          { cN: 'meta', b: '@[A-Za-z]+' },
        ],
      };
    }),
    e
  );
});
