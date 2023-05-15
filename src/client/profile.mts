interface Card {
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

interface populateResponseObject {
    success: boolean
    state: -1 | 0 | 1
    status: {
        cardList: {
            [cardName: string]: Card
        }
        inventory: {
            [cardName: string]: number
        }
        orichalcum: number
        userData: {
            id: number
            username: string
            preferences: string | null
            selectedDeck: string
        }
        deckData: Array<{
            deckID: number
            userID: number
            name: string
            cards: string
        }>
    }
}

const cardDisplay = document.getElementById('card-display')
const deckDisplay = document.getElementById('decks-display')

const decks: { [name: string]: { id: number, cards: { [name: string]: number } } } = {}
let cardData: { [name: string]: Card } = null

function generateHTML(cardData: Card, count: number): HTMLDivElement {
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

function cardPreview(cardName: string, count: number): HTMLElement {
    // Probably redundant in practice, but remove any other card previews
    const old = document.getElementById('card-preview-overlay')
    if (old) old.remove()

    // Somehow dymanically hide certain elements behind the overlay so its not distracting
    // const oldDisplayValues: { [id: string]: string } = {}
    // document.querySelectorAll('#deck-preview-overlay > [id*="deck-preview-overlay"]').forEach((element: HTMLElement) => {
    //     oldDisplayValues[element.id] = element.style.display
    //     element.style.display = 'none'
    // })
    
    // document.querySelectorAll('deck-title-card').forEach((element: HTMLElement) => {
    //     element.style.display = 'none'
    // })

    const parent = document.createElement('div')
    parent.id = 'card-preview-overlay'

    const cancleBtn = document.createElement('button')
    cancleBtn.id = 'cancel-card-preview-overlay'
    cancleBtn.innerText = 'X'
    cancleBtn.onclick = () => {
        // for (const [id, value] of Object.entries(oldDisplayValues)) document.getElementById(id).style.display = value
        // document.querySelectorAll('.card').forEach((element: HTMLElement) => {
        //     element.removeAttribute('style')
        // })
        parent.remove()
    }
    parent.appendChild(cancleBtn)

    const card = cardData[cardName]
    const cardElement = generateHTML(card, count)
    cardElement.id = 'card-preview-card-panel'

    const breakDownPanel = document.createElement('div')
    breakDownPanel.id = 'card-preview-break-down-panel'
    const cardStatsSubPanel = document.createElement('ul')
    cardStatsSubPanel.id = 'card-preview-stats-panel'
    const rarity = document.createElement('li')
    rarity.className = 'card-rarity-display'
    rarity.innerText = `Rarity: ${/*card.rarity ||*/ 'N/A'}`
    const baseAttackStat = document.createElement('li')
    baseAttackStat.className = 'card-attack-display'
    baseAttackStat.innerText = `Base attack: ${card.attack || 'N/A'}`
    const baseHealthStat = document.createElement('li')
    baseHealthStat.className = 'card-health-display'
    baseHealthStat.innerText = `Base health: ${card.health || 'N/A'}`
    const baseCostStat = document.createElement('li')
    baseCostStat.className = 'card-cost-display'
    baseCostStat.innerText = `Base cost: ${card.cost || 'N/A'}`

    cardStatsSubPanel.appendChild(rarity)
    cardStatsSubPanel.appendChild(baseCostStat)
    cardStatsSubPanel.appendChild(baseHealthStat)
    cardStatsSubPanel.appendChild(baseAttackStat)

    breakDownPanel.appendChild(cardStatsSubPanel)

    const informationPanel = document.createElement('p')
    informationPanel.id = 'card-preview-information-panel'
    informationPanel.innerHTML = card.description

    const indepthInformationPanel = document.createElement('p')
    indepthInformationPanel.id = 'card-preview-information-panel-indepth'
    indepthInformationPanel.innerHTML = /** card.information || */ 'Work in Progress | Information pending'

    parent.appendChild(cardElement)
    parent.appendChild(breakDownPanel)
    parent.appendChild(informationPanel)
    parent.appendChild(indepthInformationPanel)

    return parent
}

async function populate() {
    const res = await fetch('cardlist', { method: "POST" })
    res.json().then((data: populateResponseObject) => {
        console.log(data)
        if (data.success) {
            cardData = data.status.cardList
            console.log(cardData)
            document.getElementById('user-name-display').innerText = data.status.userData.username || 'null'
            document.getElementById('orichalcum-display').innerText = `${data.status.orichalcum}` || '0'
            for (const prop in data.status.inventory) {
                const cardElement = generateHTML(data.status.cardList[prop], data.status.inventory[prop])
                cardElement.onclick = () => {
                    cardDisplay.appendChild(cardPreview(prop, data.status.inventory[prop]))
                }
                cardDisplay.appendChild(cardElement)
            }
            for (const deck of data.status.deckData) {
                const cards: { [name: string]: number } = JSON.parse(deck.cards)
                const sumOfCardsInDeck = Object.values(cards).reduce((pre: number, cur: number) => pre + cur, 0)

                decks[deck.name] = { id: deck.deckID, cards: cards }

                // This is pretty much a slimmed down version of generateHTML()
                const parent = document.createElement('div')
                parent.className = 'card deck-title-card'

                const title = document.createElement('h3')
                title.innerHTML = `<b>${deck.name}</b>`            

                const cardCountDisplay = document.createElement('div')
                cardCountDisplay.className = 'card-count-display'
                cardCountDisplay.innerText = `x${sumOfCardsInDeck}`

                parent.appendChild(title)
                parent.appendChild(cardCountDisplay)            
                parent.appendChild(document.createElement('hr'))

                parent.onclick = () => {
                    // Enable overlay over the view area that previews what cards are in the deck
                    // Cards should have their own preview available

                    // Create overlay element
                    const overlay = document.createElement('div')
                    overlay.id = 'deck-preview-overlay'

                    const cancleBtn = document.createElement('button')
                    cancleBtn.id = 'cancel-deck-preview-overlay'
                    cancleBtn.innerText = 'X'
                    cancleBtn.onclick = () => overlay.remove()
                    overlay.appendChild(cancleBtn)

                    const display = document.createElement('div')
                    display.id = 'deck-preview-overlay-display'

                    // Add cards to overlay
                    for (const [cardName, count] of Object.entries(decks[deck.name].cards)) {
                        const cardElement = generateHTML(cardData[cardName], count)

                        cardElement.onclick = () => {
                            overlay.appendChild(cardPreview(cardName, count))
                        }

                        display.appendChild(cardElement)
                    }

                    // Add overlay to DOM
                    overlay.appendChild(display)
                    deckDisplay.appendChild(overlay)
                }

                deckDisplay.appendChild(parent)
            }
        } else {
            if (data.state === -1) {
                // Server encountered some sort of error
                document.getElementById('display-container').innerText = `${data.status}`
            } else if (data.state === 0) {
                // User not signed in, redirect to landing page
                window.location.pathname = '/'
            }
        }
    })
    pageSetup()
}

function pageSetup() {
    const labels: Array<HTMLLabelElement> = Array.from(document.querySelectorAll('#card-display-filters > label'))
    for (const label of labels) {
        label.addEventListener('click', ev => {
            ev.preventDefault()
            // I wanted to use just querySelector but it doesn't appear to work when using :checked for some reason
            Array.from(document.querySelectorAll<HTMLInputElement>('#card-display-filters > input[type="checkbox"]')).find((element: HTMLInputElement) => element.checked).checked = false
            document.querySelector<HTMLInputElement>(`#${label.htmlFor.toLowerCase()}`).checked = true
            document.querySelector<HTMLElement>(`#display-container > section[style]`)?.removeAttribute('style')
            document.querySelector<HTMLElement>(`#display-container > section[name="${label.htmlFor.toLowerCase()}"]`).style.display = 'flex'
        })
    }
    document.querySelector<HTMLElement>(`#display-container > :first-child`).style.display = 'flex'
}

document.getElementById('signout').onclick = () => fetch('signout', { method: "POST" }).then(() => window.location.pathname = '/')

window.onload = populate