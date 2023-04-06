import { io, Socket } from 'socket.io-client'

// Reference structures for client
interface Card {
    name: string
    health?: number
    cost?: number
    attack?: number
    [key: string]: any
}

interface Player {
    id: string
    energy: number
    health: number
}

interface itemActionResult {
    attackingCard?: Card
    defendingCard?: Card
    defendingPlayer?: Player
    attackingPlayer?: Player
    specialConditions?: any
}

interface attackResult {
    attackingCard?: Card
    defendingCard?: Card
    defendingPlayer?: Player
    attackingPlayer?: Player
    specialConditions?: any
}

interface ServerToClientEvents {
    confirm: (msg: string, isMyTurn: boolean) => void
    start: (player: Player) => void
    newCard: (cardData: Card, itemCheck: string) => void
    err: (errmsg: string) => void
    'player-left': () => void
    opponentDraw: () => void
    'turn-ended': () => void
    itemPlayed: (data: { card: Card, itemActionRes: itemActionResult }) => void
    updateObjectsFromPlayResult: (player: Player) => void
    opponentPlay: (data: { card: Card, itemRes: itemActionResult }) => void
    updateResourceEngine: (player: Player) => void
    attackResult: (res: attackResult, attackingCardCount: number, defendingCardCount: number) => void
    playerLeft: () => void
    gameOver: (data: { w: Player, l: Player }) => void
}

interface ClientToServerEvents {
    join: () => void
    draw: (data?: { isGenStartup: boolean, count?: number }) => void
    attack: (data: { attackingCard?: Card, defendingCard?: Card, attackingCardCount?: number, defendingCardCount?: number }) => void
    'turn-end': (startingHandGenerated: boolean) => void
    play: (data: { cName: string, attackingCard: Card | null, defendingCard: Card | null }) => void
    checkForLegalPlay: (data: { cName: string }, ack: (res: { status: boolean }) => void) => void
}

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({transports: ['websocket'], upgrade: false})

class GameState {
    energy: number
    turnCount: number
    myHealth: number
    opponentsHealth: number
    readonly maxCardCount: number
    isMyTurn: boolean
    successfullAttackRes: boolean
    canPlayCard: boolean
    attackingCard: Card | null
    defendingCard: Card | null
    myHand: Object
    myField: Object
    opponentsField: Object
    constructor () {
        this.energy = 0
        this.myHealth = 0
        this.maxCardCount = 7
        this.opponentsHealth = 0
        this.isMyTurn = false
        this.canPlayCard = false
        this.successfullAttackRes = true
        this.defendingCard = null
        this.attackingCard = null
        this.myHand = {}
        this.myField = {}
        this.opponentsField = {}
    }
}

const _opHand  = document.getElementById('opponent-hand')
const _opField = document.getElementById('opponent-played')
const _myField = document.getElementById('my-played')
const _myHand  = document.getElementById('my-hand')

function generateHTML(card: Card, count?: string) {
    const parent = document.createElement('div')
    // I'm aware this line makes little sense, but it works!
    parent.className = `card ${count ? (card.name.includes('_') ? card.name : `${card.name}${count?.includes('_') ? count : `_${count}`}`) : card.name} ${card.name.includes('_') ? card.name.split('_')[0] : card.name}`
    // We don't use ids because of the scenario of a Poseidon being played by each player, it can't be unique
    // parent.id = count ? card.name + count : card.name
    // parent.style.backgroundImage = card..imageURL

    const title = document.createElement('h3')
    title.innerHTML = `<b>${card.name}</b>`

    const stats = document.createElement('div')
    stats.innerHTML = `<span class="card-cost-display">${card.cost}</span> / <span class="card-health-display">${card.health}</span> / <span class="card-attack-display">${card.attack}</span>`

    parent.appendChild(title)
    parent.appendChild(document.createElement('br'))
    parent.appendChild(stats)

    return parent
}

function baseCardWithBG(): HTMLDivElement {
    let _ = document.createElement('div')
    _.style.backgroundImage = `url(../favicon.png)`
    _.className = 'card card-b'
    return _
}

const Game: GameState | null = new GameState()
let startingHandGenerated: boolean = false

function endTurn() {
    // Game#successfullAttackRes is initialized as true
    if (!Game.successfullAttackRes) return
    socket.emit('turn-end', startingHandGenerated)
    Game.isMyTurn = false
    Game.canPlayCard = false
    Game.attackingCard = null
    Game.defendingCard = null
    // TODO: Maybe move this server side?
    if (startingHandGenerated) {
        const numOfCardsInHand = document.querySelectorAll('#my-hand > div').length
        const cardsToDraw = Game.maxCardCount - numOfCardsInHand
        for (let i = 0; i < cardsToDraw; i++) socket.emit('draw')
    }
    document.querySelector<HTMLElement>('#my-hand .health-display').style.borderColor = Game.isMyTurn ? 'blue' : 'red'
    document.querySelector<HTMLElement>('#opponent-hand .health-display').style.borderColor = Game.isMyTurn ? 'red' : 'blue'
}

function play(cardNameWithCount: string) {
    // Update client game state and ui as well as send update to server
    const card = Game.myHand[cardNameWithCount]
    // There are two different counts at play here, my brain doesn't enjoy this
    const cardName = cardNameWithCount.split('_')[0]
    if (card) {
        if (!card.typings.isItem) {
            // This looks very pointless but this is technically looking at a different part of the game state than the recurse in socket#on('newCard') is looking at and managing said state
            let count = 1
            !function recurse() {
                if (!Game.myField[`${cardName}_${count}`]) {
                    Game.myField[`${cardName}_${count}`] = card
                } else {
                    count++
                    return recurse()
                }
            }()
            // A hopefully temp fix to keeping count consistent between the game state and the ui
            const element = document.querySelector(`#${_myField.id} .${cardNameWithCount}`)
            element.classList.remove(cardNameWithCount)
            element.classList.add(cardName + "_" + count)
            Game.myField[cardName + `_${count}`] = card
        }
        delete Game.myHand[cardNameWithCount]
        // Server doesn't care what count is
        socket.emit('play', {cName: cardName, attackingCard: Game.attackingCard || null, defendingCard: Game.defendingCard || null})
    }
}

function selectCardForAction(cardName: string, cardElement: HTMLElement, cardCount = null) {
    const field = cardElement.parentElement
    const isMyCard: boolean = cardElement.parentElement.id === _myField.id
    const selection = isMyCard ? 'attackingCard' : 'defendingCard'
    const hand = isMyCard ? 'myField' : 'opponentsField'
    // Count is going to be different than what would be passed to this function as the UI gets updated
    // Because of this, we must read the UI to dynamically determine what count should be
    let count = null
    if (isMyCard) count = cardElement.className.match(/\w+_\d/)[0].split('_')[1]
    // Update game state
    Game[selection] = Game[hand][!cardName.includes('_') ? `${cardName}_${count}` : cardName]
    // If we want to unselect a card we've selected
    if (cardElement.classList.contains('card-select-for-action')) {
        Game[selection] = null
        cardElement.classList.remove('card-select-for-action')
        return
    }
    // Clear any previous selections
    for (let i = 0; i < field.children.length; i++) field.children[i].classList.remove('card-select-for-action')
    // Update ui with new selection
    cardElement.classList.add('card-select-for-action')
}

function itemPlayed(itemRes: itemActionResult): void {
    setTimeout(() => { document.getElementById('played-item').style.border = `thin solid ${Game.isMyTurn ? 'blue' : 'red'}` }, 2000)
    // All these conditions should be checked on a case by case basis, ironically this is exactly why we can't use a switch case here
    const { attackingCard, defendingCard, defendingPlayer, attackingPlayer } = itemRes
    if (attackingCard) {
        // "attacking" in this case means that the player selected one of their own cards for the item to select
        const field = Game.isMyTurn ? Game.myField : Game.opponentsField
        // Update game state
        field[attackingCard.name] = attackingCard
        // Update UI
        const e = generateHTML(attackingCard)
        e.onclick = () => selectCardForAction(attackingCard.name, e)
        document.querySelector(`#${Game.isMyTurn ? _myField.id : _opField.id} .${attackingCard.name}`).replaceWith(e)
    }
    if (defendingCard) {
        const field = Game.isMyTurn ? Game.opponentsField : Game.myField
        // Update game state
        field[defendingCard.name] = defendingCard
        // Update UI
        const elem = generateHTML(defendingCard)
        elem.onclick = () => selectCardForAction(defendingCard.name, elem)
        document.querySelector(`#${Game.isMyTurn ? _opField.id : _myField.id} .${defendingCard.name}`).replaceWith(elem)
    }
    if (defendingPlayer) {
        // If a player was attacked and it is currently my turn, update opponents health, if its not my turn than I have been attacked
        Game[Game.isMyTurn ? 'opponentsHealth' : 'myHealth'] = defendingPlayer.health
        document.querySelector<HTMLElement>(`#${Game.isMyTurn ? _opHand.id : _myHand.id} .health-display`).innerText = `${defendingPlayer.health}`
    }
    if (attackingPlayer) {
        // This logic is basically the opposite of defendingPlayer
        Game[Game.isMyTurn ? 'myHealth' : 'opponentsHealth'] = attackingPlayer.health
        document.querySelector<HTMLElement>(`#${Game.isMyTurn ? _myHand.id : _opHand.id} .health-display`).innerText = `${attackingPlayer.health}`
    }
    // Clear UI, the item card html should be the only child node
    setTimeout(() =>{
        document.getElementById('played-item').children[0].remove()
        document.getElementById('played-item').style.border =  ''
    }, 4000)
    Game.canPlayCard = true
}

socket.on('confirm', (msg, isMyTurn) => {
    console.info(msg)
    Game.isMyTurn = isMyTurn
})

socket.on('err', (errmsg: string) => console.error(errmsg))

socket.on('start', player => {
    console.log(Game)
    // Gen initial hand
    if (Game.isMyTurn) {
        for (let i = 0; i < Game.maxCardCount; i++) socket.emit('draw', { isGenStartup: true })
        endTurn()
        startingHandGenerated = true
    }
    for (let i = 0; i < Game.maxCardCount; i++) _opHand.appendChild(baseCardWithBG())
    tick()
    Game.energy = player.energy
    Game.myHealth = player.health
    Game.opponentsHealth = player.health
    // Forcing conversion to string
    document.getElementById('resource-display-count').innerText = `${Game.energy}`
})

socket.on('updateResourceEngine', player => {
    Game.energy = player.energy
    document.getElementById('resource-display-count').innerText = `${Game.energy}`
})

socket.on('turn-ended', () => {
    Game.isMyTurn = true
    Game.canPlayCard = true
    if (!startingHandGenerated) {
        for (let i = 0; i < 7; i++) socket.emit('draw', { isGenStartup: true })
        endTurn()
        startingHandGenerated = true
    } else {
        // Refresh opponents hand, minus 1 is accounting for the health display element which is also a child of _opHand
        while (_opHand.children.length - 1 < Game.maxCardCount) {
            _opHand.appendChild(baseCardWithBG())
        }
    }
    document.querySelector<HTMLElement>('#my-hand .health-display').style.borderColor = Game.isMyTurn ? 'blue' : 'red'
    document.querySelector<HTMLElement>('#opponent-hand .health-display').style.borderColor = Game.isMyTurn ? 'red' : 'blue'
})

socket.on('newCard', (card, itemCheck) => {
    if (itemCheck) card.check = Function(`"use strict"; return (${itemCheck.replace(/function \w* ?\(\w*\)/, '() =>')})`)()
    if (card) {
        // Client Side Game State
        let count = 1
        // Concise documentation is an unrealistic expectation
        !function recurse() {
            if (!Game.myHand[`${card.name}_${count}`]) {
                Game.myHand[`${card.name}_${count}`] = card
            } else {
                count++
                return recurse()
            }
        }()
        // UI
        const e = generateHTML(card, `_${count}`)
        e.onclick = () => {
            socket.emit('checkForLegalPlay', {cName: card.name}, (res) => {
                if (!Game.canPlayCard || !Game.isMyTurn || !res.status) return
                // If the card is an item, check that it can in fact be played, technically this shouldn't need Game passed to it but we are doing it anyways
                // Upon the check failing, we should at some point notify the player what about the check failed
                if (card.typings.isItem && itemCheck) if (!card.check(Game)) return
                Game.canPlayCard = false
                // Changed from using outerHTML to regenerating the card html and appending it
                const generatedHTMLForCard = generateHTML(card, `_${count}`)
                document.getElementById(card.typings.isItem ? 'played-item' : 'my-played').appendChild(generatedHTMLForCard)
                // At the point of this click event firing the element is a child of either #my-played or #played-item
                const newCard: HTMLElement = document.querySelector(`#${card.typings.isItem ? 'played-item' : 'my-played'} .${card.name}_${count}`)
                // Setup cards onclick to be used to attack
                if (!card.typings.isItem) newCard.onclick = ev => selectCardForAction(newCard.className.split(' ').find(c => c.includes('_')), newCard)
                e.classList.add('moving')
                newCard.style.visibility = 'hidden'
                // @ts-ignore Style is readonly but it isn't
                e.style = `--new-x: ${newCard.getBoundingClientRect().x}px;
                --current-x: ${e.getBoundingClientRect().x}px;
                --current-y: ${e.getBoundingClientRect().y}px;
                --new-y: ${newCard.getBoundingClientRect().y}px;`

                setTimeout(() => {
                    e.remove()
                    newCard.style.visibility = 'visible'
                    if(!card.typings.isItem) Game.canPlayCard = true
                }, 1900)

                play(card.name + `_${count}`)
            })
        }
        _myHand.appendChild(e)
    }
})

socket.on('attackResult', (res, attackingCardCount, defendingCardCount) => {
    // Ensure consistent formatting, may be redundant
    if (!res.attackingCard.name.includes('_')) res.attackingCard.name += `_${attackingCardCount}`
    if (!res.defendingCard.name.includes('_')) res.defendingCard.name += `_${defendingCardCount}`
    // Reset game state
    Game.attackingCard = null
    Game.defendingCard = null
    // Prevent end of turn temporarily
    Game.successfullAttackRes = false
    // If a player has been attacked then update UI
    if (res.defendingPlayer !== null) {
        document.querySelector<HTMLElement>(`#${!Game.isMyTurn ? 'my-hand' : 'opponent-hand'} .health-display`).innerText = `${res.defendingPlayer.health}`
        Game[Game.isMyTurn ? 'opponentsHealth' : 'myHealth'] = res.defendingPlayer.health
    }

    const defendingCardElement = document.querySelector(`#${Game.isMyTurn ? _opField.id : _myField.id} .${res.defendingCard.name}`)
    const hand = Game.isMyTurn ? 'opponentsField' : 'myField'
    // If a card has been defeated, deal with it, otherwise basic game state management
    if (res.defendingCard.health <= 0) {
        defendingCardElement.remove()
        delete Game[hand][res.defendingCard.name]
    } else {
        // Update game state
        Game[hand][res.defendingCard.name] = res.defendingCard
        // Update UI
        const newCard = generateHTML(res.defendingCard, `_${defendingCardCount}`)
        // @ts-ignore composedPath has type EventTarget[]
        newCard.onclick = ev => selectCardForAction(res.defendingCard.name, newCard || ev.composedPath()[0])
        defendingCardElement.replaceWith(newCard)
    }
    // Allow continue of play
    Game.successfullAttackRes = true
    if (Game.isMyTurn) document.querySelector('#my-played .card-select-for-action')?.classList.remove('card-select-for-action')
})

socket.on('opponentPlay', data => {
    // TODO: Animate opponents card being played
    // Update game state
    let count = 1
    !function recurse() {
        if (!Game.opponentsField[`${data.card.name}_${count}`]) {
            if (!data.card.typings?.isItem) Game.opponentsField[`${data.card.name}_${count}`] = data.card
        } else {
            count++
            return recurse()
        }
    }()
    // Update UI
    document.getElementsByClassName('card-b')[0].remove()
    const newOpCard = generateHTML(data.card, `_${count}`)
    if (data.itemRes) {
        document.getElementById('played-item').appendChild(newOpCard)
        itemPlayed(data.itemRes)
    } else {
        newOpCard.onclick = () => selectCardForAction(`${data.card.name}_${count}`, newOpCard)
        _opField.appendChild(newOpCard)
    }
})

socket.on('itemPlayed', data => itemPlayed(data.itemActionRes))

socket.on('playerLeft', () => {
    const overlay = document.createElement('div')
    overlay.className = 'game-end-overlay'
    const content = document.createElement('div')
    content.id = "overlay-content"
    content.innerText = 'Your opponent has left, the game has ended.'
    content.innerHTML += '<br/><button><a href="/">Return Home</a></button>'
    overlay.appendChild(content)
    document.body.appendChild(overlay)
    socket.close()
})

socket.on('gameOver', data => {
    // Create an overlay to block the player from interacting with the playing feild
    const overlay = document.createElement('div')
    overlay.className = 'game-end-overlay'
    const content = document.createElement('div')
    content.id = 'overlay-content'
    content.innerText = `Winner:\n${data.w.id}\n\nLoser:\n${data.l.id}`
    overlay.appendChild(content)
    document.body.appendChild(overlay)
    socket.close()
    console.info(`Winner: ${data.w.id}\nLoser: ${data.l.id}`)

})

const btn = document.getElementById('submit')

function action() {
    const attackingCard = Game.attackingCard
    const defendingCard = Game.defendingCard
    const attackingCardCount: number = parseInt(document.querySelector(`#${_myField.id} > .card-select-for-action`)?.className.match(/\w+_\d/)[0].split('_')[1])
    const defendingCardCount: number = parseInt(document.querySelector(`#${_opField.id} > .card-select-for-action`)?.className.match(/\w+_\d/)[0].split('_')[1])
    if (Game.isMyTurn && attackingCard?.attack && attackingCardCount && defendingCardCount) socket.emit('attack', {attackingCard: attackingCard, defendingCard: defendingCard, attackingCardCount: attackingCardCount, defendingCardCount: defendingCardCount })
}

// General UI managment in a response to the game state
function tick() {
    const isActionState = Game.attackingCard && Game.defendingCard
    btn.onclick = isActionState ? action : (Game.isMyTurn ? endTurn : null)
    btn.innerText = isActionState ? 'Attack' : 'End Turn'
    // @ts-ignore HTMLElement#style is supposedly read-only but also isn't
    btn.style = `--color-start: ${isActionState ? 'rgb(255 136 136)' : 'rgb(83, 135, 153)'};
    --color-end: ${isActionState ? 'red' : 'darkblue'};`
    btn.classList[Game.isMyTurn ? 'remove' : 'add']('unavailable')

    for (let i = 0; i < document.getElementsByClassName('card').length; i++) if (!document.getElementsByClassName('card')[i].parentElement.id.includes('opponent')) document.getElementsByClassName('card')[i].classList[Game.isMyTurn ? 'remove' : 'add']('unavailable')
    document.getElementById('resource-display-container').classList[Game.isMyTurn ? 'remove' : 'add']('unavailable')
    setTimeout(tick, 500)
}

function clientSetUp() {
    const e = document.getElementById('resource-display-container')
    const b = document.getElementById('submit')
    e.style.width = `${b.getBoundingClientRect().x}px`
    e.style.height = `${window.innerHeight - b.getBoundingClientRect().y}px`
    document.getElementById('resource-display').style.width = `${(window.innerWidth - b.getBoundingClientRect().width) / 2}px`
}

window.onload = () => { clientSetUp(); socket.emit('join') }