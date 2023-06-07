class Game {
    players: Array<Player>
    playingField: { player?: {id?: string, cards?: {}} }
    discard: Array<Card>
    turnCount: number
    constructor () {
        this.players = []
        this.playingField = {}
        this.discard = []
        this.turnCount = 1
    }

    join(socketID: string, globalID: string, cardData: string, playerName: string): void {
        if (this.players.length < 3) {
            const cards = JSON.parse(cardData)
            console.log(cards)
            const deckMap = new Map
            for (const [name, count] of Object.entries(cards)) deckMap.set(name, [{ ..._cardList[name] }, count])
            const p = new Player({ id: globalID, name: playerName, socketID: socketID, deck: new Deck({ deckMap: deckMap }), isTakingTurn: this.players.length === 0 ? true : false, health: 30})
            // Set initial energy count, energy is based on what turn it is
            p.energy = this.turnCount
            this.players.push(p)
            // Init players field object
            this.playingField[globalID] = {id: globalID, cards: {}}
        }
    }

    playCard(card: Card, id: string): boolean {
        const player = this.players.find((p: Player) => p.id === id)
        if (card.cost > player.energy) return false
        player.energy -= card.cost

        if (!card.typings?.isItem) {
            // Server side game state management
            let count = 1
            // Since we are using function notation we lose top level this context
            const gameInstance = this
            !function recurse() {
                if (!gameInstance.playingField[id].cards[card.name + '_' + count]) {
                    gameInstance.playingField[id].cards[card.name + '_' + count] = card
                } else {
                    count++
                    return recurse()
                }
            }()
        } else {
            // Add item card to discard
            this.discard.push(card)
        }

        // Remove card from players hand
        player.hand.splice(player.hand.findIndex((card: Card) => card.name.toLowerCase() === card.name.toLowerCase()), 1)

        return true
    }

    drawCard(playerID: string): Card | null {
        // Get the player
        const player: Player = this.players.find(player => player.id === playerID)
        // Draw a card, make sure we actually can draw a card
        if (this.players.length === 2) {
            const card: Card = player.deck.draw()
            // Add card to the players hand on our side to better manage game state
            player.hand.push(card)
            if (!card) console.error('Could not draw card')
            return card
        }
        return null
    }

    endTurn(startingHandGenerated: boolean): void {
        // If player 2 is finishing their turn and its not the initial game setup, we have completed a round
        if (this.players[1].isTakingTurn && startingHandGenerated) {
            this.turnCount++
            this.players[0].energy = this.turnCount
            this.players[1].energy = this.turnCount
        }
        // Simply update game state
        this.players[0].isTakingTurn = this.players[0].isTakingTurn ? false : true
        this.players[1].isTakingTurn = this.players[1].isTakingTurn ? false : true
    }

    checkGameOver(): { w: {player: Player, exp: number}, l: {player: Player, exp: number} } | boolean {
        const P1 = this.players[0]
        const P2 = this.players[1]
        if (P1.health <= 0 || P2.health <= 0) {
            return { w: { player: P1.health > 0 ? P1 : P2, exp: 5 }, l: { player: P1.health <= 0 ? P1 : P2, exp: 2 } }
        }
        return false
    }
}

module.exports.Game = Game