
var ns = $( "#menu_rcp > a > strong > small"
          + ", #menu_pm > a > strong > small")
  , topBar = $("#toggle-topmenu + label")[0]

for (var i = 0, l = ns.length; i < l; i++)
    if (parseInt(ns[i].textContent) > 0)
        topBar.classList.add("glow")

