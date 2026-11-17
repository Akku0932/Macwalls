/* Image-stream corridor: two rails of cards rush from a vanishing point
   toward the viewer, used here as a backdrop behind the laptop mockup.
   Plain-JS port of the ImageStreamHero component (see its source comments
   for the geometry rationale). Call initCorridor(root, images, opts) once
   root is in the document; root must be position:absolute (or similar)
   inside a position:relative, overflow:hidden ancestor. */
window.initCorridor = function (root, images, opts) {
  opts = opts || {};
  var p = Object.assign({
    perspective: 30, cardWidth: 18, cardHeight: 25, cardRadius: 0.4,
    birthHeight: 2.6, exitHeight: 46, railBirth: -11, railExit: 44,
    fan: 3.3, turnBirth: 6, turnExit: 28, stops: 24
  }, opts.path || {});
  var cards = opts.cards || 9;
  var speed = opts.speed || 18;
  var axis = opts.axis != null ? opts.axis : 55;
  var id = 'corr' + Math.random().toString(36).slice(2, 9);
  var rightName = 'ish-r-' + id, leftName = 'ish-l-' + id, cardClass = 'ish-c-' + id;

  function keyframes(dir, name) {
    var steps = [];
    for (var s = 0; s <= p.stops; s++) {
      var u = s / p.stops;
      // Geometric in apparent size: a constant size ratio between
      // consecutive cards keeps the ribbon solid at both ends.
      var scale = (p.birthHeight / p.cardHeight) * Math.pow(p.exitHeight / p.birthHeight, u);
      var z = p.perspective * (1 - 1 / scale);
      var rail = p.railExit - (p.railExit - p.railBirth) * Math.pow(1 - u, p.fan);
      var turn = p.turnBirth + (p.turnExit - p.turnBirth) * u;
      steps.push((u * 100).toFixed(2) + '%{transform:translate3d(' +
        (dir * rail).toFixed(2) + 'cqw,0,' + z.toFixed(2) + 'cqw) rotateY(' +
        (-dir * turn).toFixed(2) + 'deg)}');
    }
    return '@keyframes ' + name + '{' + steps.join('') + '}';
  }

  var css = keyframes(1, rightName) + keyframes(-1, leftName) +
    '@media(prefers-reduced-motion:reduce){.' + cardClass + '{animation-play-state:paused}}';
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  root.appendChild(styleEl);

  root.style.containerType = 'inline-size';

  var persp = document.createElement('div');
  persp.style.cssText = 'position:absolute;inset:0;perspective:' + p.perspective +
    'cqw;perspective-origin:50% ' + axis + '%';
  var inner = document.createElement('div');
  inner.style.cssText = 'position:absolute;inset:0;transform-style:preserve-3d';
  persp.appendChild(inner);
  root.appendChild(persp);

  var fallback = ['#1b5a38', '#2a3a5c', '#5a3a2a', '#3a2a5a'];
  [rightName, leftName].forEach(function (name) {
    for (var i = 0; i < cards; i++) {
      var img = images.length ? images[i % images.length] : null;
      var div = document.createElement('div');
      div.className = cardClass;
      div.style.cssText = 'position:absolute;overflow:hidden;left:50%;top:' + axis +
        '%;width:' + p.cardWidth + 'cqw;height:' + p.cardHeight + 'cqw;margin-left:' +
        (-p.cardWidth / 2) + 'cqw;margin-top:' + (-p.cardHeight / 2) + 'cqw;border-radius:' +
        p.cardRadius + 'cqw;animation:' + name + ' ' + speed + 's linear infinite;' +
        'animation-delay:' + (-(i * speed) / cards) + 's;backface-visibility:hidden;' +
        'background:' + (img ? 'url("' + encodeURI(img.src) + '") center/cover,' : '') +
        fallback[i % fallback.length] + ';';
      inner.appendChild(div);
    }
  });

  return { right: rightName, left: leftName, card: cardClass };
};
