interface populateResponseObject {
    success: boolean
    state: -1 | 0 | 1
    status: {
        cardList: {
            [cardName: string]: {
                name: string
                description: string
                health: number
                maxHealth: number
                attack: number
                cost: number
                imgURL: string | null
                typings: {
                    [type: string]: boolean
                }
            }
        },
        inventory: {
            [cardName: string]: number
        }
    }
}

const cardDisplay = document.getElementById('card-display')

// I should change how I'm typing cardData later
function generateHTML(cardData: populateResponseObject["status"]["cardList"]["cardName"], count: number): HTMLDivElement {
    const parent = document.createElement('div')
    parent.className = 'card'

    const title = document.createElement('h3')
    title.innerHTML = `<b>${cardData.name}</b>`

    const countDisplay = document.createElement('div')
    countDisplay.className = 'card-count-display'
    countDisplay.innerText = `x${count}`

    const stats = document.createElement('div')
    stats.innerHTML = `<span class="card-cost-display">${cardData.cost}</span> / <span class="card-health-display">${cardData.health}</span> / <span class="card-attack-display">${cardData.attack}</span>`

    parent.appendChild(title)
    parent.appendChild(countDisplay)
    parent.appendChild(document.createElement('br'))
    parent.appendChild(stats)

    return parent
}

async function populate() {
    const res = await fetch('cardlist', { method: "POST" })
    res.json().then((data: populateResponseObject) => {
        console.log(data)
        if (data.success) {
            // Hard coding for now, server should sent basic user info later
            document.getElementById('user-name-display').innerText = 'Craft485'
            for (const prop in data.status.inventory) {
                // const element = generateHTML(data.status.cardList[prop], data.status.inventory[prop])
                cardDisplay.appendChild(generateHTML(data.status.cardList[prop], data.status.inventory[prop]))
                console.log(prop)
            }
        }
    })
}

function signout() {
    console.log('signout')
}

document.getElementById('signout').onclick = signout

window.onload = populate