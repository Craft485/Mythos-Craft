interface _PlayerProps {
    deck: Deck
    id: string | number
    socketID: string
    health: number
    energy?: number
    isTakingTurn?: boolean
}

class Player {
    deck: Deck
    id: string | number
    socketID: string
    health: number
    isTakingTurn: boolean
    energy: number
    hand: Array<Card>
    constructor (props: _PlayerProps) {
        this.id = props.id
        this.socketID = props.socketID
        this.deck = props.deck
        this.isTakingTurn = props.isTakingTurn || false
        this.health = props.health
        this.energy = 0
        this.hand = []
    }
}

module.exports.Player = Player