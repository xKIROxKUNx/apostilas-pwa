(function () {
  try {
    var t = localStorage.getItem("apostilas-theme");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {
  }

  window.addEventListener(
    "error",
    function (evento) {
      var alvo = evento.target;
      if (!alvo || (alvo.tagName !== "SCRIPT" && alvo.tagName !== "LINK")) return;
      if ((alvo.src || alvo.href || "").indexOf("/assets/") === -1) return;
      try {
        var ultima = Number(sessionStorage.getItem("apostilas-recarga") || 0);
        if (Date.now() - ultima < 60000) return;
        sessionStorage.setItem("apostilas-recarga", String(Date.now()));
      } catch (e) {
        return;
      }
      location.reload();
    },
    true
  );
})();
