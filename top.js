
var qsa = Document.prototype.querySelectorAll.bind(document)

function viewFormat(s) {
    var fs = ["", "k", "m", "b"]

    var ss = s.split("<br>")
    var cs = ss[0].split(/,/g)
    var v = cs[0].trim() + fs[cs.length - 1]
    var w = ss[1] ? "\n\uf007 " + ss[1].split(' ')[0] : ""

    return v + w
}

function views(vs) {
    for (var i = 0, l = vs.length; i < l; i++) {
        vs[i].dataset.desc = vs[i].innerHTML.split("<br>")[0].trim()
        vs[i].textContent = viewFormat(vs[i].innerHTML)
    }
}

function tf() {
  time += 100

  var vs = qsa(".c_cat-replies > a, .c_cat-views")
  if (vs.length > 0) {
    views(vs)
    mo.observe($("#inlinetopic")[0], { childList: true })

  } else if (time < maxTime)
    tu = setTimeout(tf, 100)
}

// this is super dumb but let's pretend it's not
var maxTime = 1000
var time = 0
var tu = setTimeout(tf, 100)

var mo = new MutationObserver(function(ms) {
  ms.forEach(function(m) {
    var vs = qsa(".c_cat-replies > a, .c_cat-views")
    views(vs)
  })
})

