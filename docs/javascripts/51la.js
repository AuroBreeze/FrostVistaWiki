(function () {
  var script = document.createElement("script");
  script.charset = "UTF-8";
  script.id = "LA_COLLECT";
  script.src = "//sdk.51.la/js-sdk-pro.min.js";
  script.onload = function () {
    if (window.LA) {
      window.LA.init({
        id: "3QBGdvRsTgSoYbnJ",
        ck: "3QBGdvRsTgSoYbnJ",
        autoTrack: true,
        hashMode: true,
        screenRecord: true,
      });
    }
  };
  document.head.appendChild(script);
})();
