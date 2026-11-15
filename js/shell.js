(function () {
  'use strict';

  var grid = document.getElementById('grid');
  var KODE = '2412';
  // En lille haengelaas i kortets hjoerne, saa man kan se, at kortet kraever koden
  var LAAS = '<svg class="laas" viewBox="0 0 40 44" width="34" height="38" aria-hidden="true">' +
    '<path d="M11 20v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#6b5545" stroke-width="5" stroke-linecap="round"/>' +
    '<rect x="5" y="19" width="30" height="22" rx="7" fill="#f0c46a" stroke="#6b5545" stroke-width="3"/>' +
    '<circle cx="20" cy="29" r="3.2" fill="#6b5545"/></svg>';

  var maaned = new Date().getMonth();
  window.SPIL.forEach(function (spil) {
    // Julekalenderen vises kun i november og december
    if (spil.maaneder && spil.maaneder.indexOf(maaned) < 0) return;
    var a = document.createElement('a');
    a.className = 'card';
    a.href = spil.sti;
    a.style.background = spil.farve;
    a.innerHTML =
      (spil.art || '') +
      (spil.laast ? LAAS : '') +
      '<h2>' + spil.navn + '</h2>' +
      '<p>' + spil.tekst + '</p>';
    if (spil.laast) a.addEventListener('click', function (e) { e.preventDefault(); spoergKode(spil); });
    grid.appendChild(a);
  });

  /*
   * Kodeordet. Nye ting (julekalenderen, Isvigen) kan kun aabnes med koden, til de
   * er klar til alle. Det er en laas for boernene, ikke en sikkerhed: koden staar
   * her, og intet gemmes, saa den skal tastes hver gang. Fjern laast: true i
   * js/games.js for at aabne for alle.
   */
  function spoergKode(spil) {
    var tastet = '';
    var bag = document.createElement('div');
    bag.className = 'kode';
    bag.innerHTML = '<div class="kode-kort" role="dialog" aria-label="Kode">' +
      '<button class="kode-luk" aria-label="Luk">&times;</button>' + LAAS.replace('class="laas"', 'class="laas stor"') +
      '<div class="kode-prikker">' + '<i></i><i></i><i></i><i></i>' + '</div>' +
      '<div class="kode-taster">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '&larr;'].map(function (t) {
        return t === '' ? '<span></span>' : '<button data-t="' + (t === '&larr;' ? 'slet' : t) + '">' + t + '</button>';
      }).join('') + '</div></div>';
    document.body.appendChild(bag);
    var prikker = bag.querySelectorAll('.kode-prikker i'), kort = bag.querySelector('.kode-kort');
    function vis() { for (var i = 0; i < prikker.length; i++) prikker[i].className = i < tastet.length ? 'fyldt' : ''; }
    function luk() { if (bag.parentNode) bag.parentNode.removeChild(bag); }
    bag.addEventListener('click', function (e) {
      if (e.target === bag || e.target.closest('.kode-luk')) { luk(); return; }
      var k = e.target.closest('[data-t]');
      if (!k || tastet.length >= KODE.length) return;
      if (k.dataset.t === 'slet') tastet = tastet.slice(0, -1); else tastet += k.dataset.t;
      vis();
      if (tastet.length < KODE.length) return;
      if (tastet === KODE) { window.location.href = spil.sti + (spil.proeve && maaned !== 11 ? spil.proeve : ''); return; }
      kort.classList.add('ryst');
      setTimeout(function () { kort.classList.remove('ryst'); tastet = ''; vis(); }, 500);
    });
  }

  // Dobbelttryk-zoom findes stadig på iPad selv med user-scalable=no.
  var sidsteTryk = 0;
  document.addEventListener('touchend', function (e) {
    var nu = Date.now();
    if (nu - sidsteTryk < 320) e.preventDefault();
    sidsteTryk = nu;
  }, { passive: false });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (fejl) {
        console.warn('Service worker blev ikke registreret:', fejl);
      });
    });
    // Naar en ny version af service workeren tager over, genindlaeses menuen,
    // saa man aldrig ser en blanding af gamle og nye filer.
    var havdeController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (havdeController) window.location.reload();
      havdeController = true;
    });
  }
})();
