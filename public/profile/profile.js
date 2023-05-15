(()=>{"use strict";const e=document.getElementById("card-display"),t=document.getElementById("decks-display"),n={};let a=null;function c(e,t){const n=document.createElement("div");n.className="card";const a=document.createElement("h3");a.innerHTML=`<b>${e.name}</b>`;const c=document.createElement("div");c.className="card-count-display",c.innerText=`x${t}`;const d=document.createElement("div");return d.innerHTML=`<span class="card-cost-display">${e.cost}</span> / <span class="card-health-display">${e.health}</span> / <span class="card-attack-display">${e.attack}</span>`,n.appendChild(a),n.appendChild(c),n.appendChild(document.createElement("br")),n.appendChild(d),n}function d(e,t){const n=document.getElementById("card-preview-overlay");n&&n.remove();const d=document.createElement("div");d.id="card-preview-overlay";const l=document.createElement("button");l.id="cancel-card-preview-overlay",l.innerText="X",l.onclick=()=>{d.remove()},d.appendChild(l);const o=a[e],i=c(o,t);i.id="card-preview-card-panel";const r=document.createElement("div");r.id="card-preview-break-down-panel";const s=document.createElement("ul");s.id="card-preview-stats-panel";const p=document.createElement("li");p.className="card-rarity-display",p.innerText="Rarity: N/A";const m=document.createElement("li");m.className="card-attack-display",m.innerText=`Base attack: ${o.attack||"N/A"}`;const u=document.createElement("li");u.className="card-health-display",u.innerText=`Base health: ${o.health||"N/A"}`;const h=document.createElement("li");h.className="card-cost-display",h.innerText=`Base cost: ${o.cost||"N/A"}`,s.appendChild(p),s.appendChild(h),s.appendChild(u),s.appendChild(m),r.appendChild(s);const y=document.createElement("p");y.id="card-preview-information-panel",y.innerHTML=o.description;const v=document.createElement("p");return v.id="card-preview-information-panel-indepth",v.innerHTML="Work in Progress | Information pending",d.appendChild(i),d.appendChild(r),d.appendChild(y),d.appendChild(v),d}document.getElementById("signout").onclick=()=>fetch("signout",{method:"POST"}).then((()=>window.location.pathname="/")),window.onload=async function(){(await fetch("cardlist",{method:"POST"})).json().then((l=>{if(console.log(l),l.success){a=l.status.cardList,console.log(a),document.getElementById("user-name-display").innerText=l.status.userData.username||"null",document.getElementById("orichalcum-display").innerText=`${l.status.orichalcum}`||"0";for(const t in l.status.inventory){const n=c(l.status.cardList[t],l.status.inventory[t]);n.onclick=()=>{e.appendChild(d(t,l.status.inventory[t]))},e.appendChild(n)}for(const e of l.status.deckData){const l=JSON.parse(e.cards),o=Object.values(l).reduce(((e,t)=>e+t),0);n[e.name]={id:e.deckID,cards:l};const i=document.createElement("div");i.className="card deck-title-card";const r=document.createElement("h3");r.innerHTML=`<b>${e.name}</b>`;const s=document.createElement("div");s.className="card-count-display",s.innerText=`x${o}`,i.appendChild(r),i.appendChild(s),i.appendChild(document.createElement("hr")),i.onclick=()=>{const l=document.createElement("div");l.id="deck-preview-overlay";const o=document.createElement("button");o.id="cancel-deck-preview-overlay",o.innerText="X",o.onclick=()=>l.remove(),l.appendChild(o);const i=document.createElement("div");i.id="deck-preview-overlay-display";for(const[t,o]of Object.entries(n[e.name].cards)){const e=c(a[t],o);e.onclick=()=>{l.appendChild(d(t,o))},i.appendChild(e)}l.appendChild(i),t.appendChild(l)},t.appendChild(i)}}else-1===l.state?document.getElementById("display-container").innerText=`${l.status}`:0===l.state&&(window.location.pathname="/")})),function(){const e=Array.from(document.querySelectorAll("#card-display-filters > label"));for(const t of e)t.addEventListener("click",(e=>{e.preventDefault(),Array.from(document.querySelectorAll('#card-display-filters > input[type="checkbox"]')).find((e=>e.checked)).checked=!1,document.querySelector(`#${t.htmlFor.toLowerCase()}`).checked=!0,document.querySelector("#display-container > section[style]")?.removeAttribute("style"),document.querySelector(`#display-container > section[name="${t.htmlFor.toLowerCase()}"]`).style.display="flex"}));document.querySelector("#display-container > :first-child").style.display="flex"}()}})();