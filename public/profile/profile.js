(()=>{"use strict";const n=document.getElementById("card-display");function e(n,e){const t=document.createElement("div");t.className="card";const a=document.createElement("h3");a.innerHTML=`<b>${n.name}</b>`;const s=document.createElement("div");s.className="card-count-display",s.innerText=`x${e}`;const c=document.createElement("div");return c.innerHTML=`<span class="card-cost-display">${n.cost}</span> / <span class="card-health-display">${n.health}</span> / <span class="card-attack-display">${n.attack}</span>`,t.appendChild(a),t.appendChild(s),t.appendChild(document.createElement("br")),t.appendChild(c),t}document.getElementById("signout").onclick=function(){console.log("signout")},window.onload=async function(){(await fetch("cardlist",{method:"POST"})).json().then((t=>{if(console.log(t),t.success){document.getElementById("user-name-display").innerText="Craft485";for(const a in t.status.inventory)n.appendChild(e(t.status.cardList[a],t.status.inventory[a])),console.log(a)}}))}})();