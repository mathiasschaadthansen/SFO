(function () {
  'use strict';

  var grid = document.getElementById('grid');

  window.SPIL.forEach(function (spil) {
    var a = document.createElement('a');
    a.className = 'card';
    a.href = spil.sti;
    a.style.background = spil.farve;
    a.innerHTML =
      (spil.art || '') +
      '<h2>' + spil.navn + '</h2>' +
      '<p>' + spil.tekst + '</p>';
    grid.appendChild(a);
  });

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
