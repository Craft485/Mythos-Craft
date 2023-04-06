import * as express from 'express'
const app = express()
const http = require('http').createServer(app)
const io = require('socket.io')(http)
import * as morgan from 'morgan'
import * as path from 'path'
// @ts-ignore
import { Game, _cardList as cardList } from './assets.js'
import { Socket } from 'socket.io'

app.use(morgan(':remote-addr :method :url :status :response-time ms :res[content-length]'))
app.use(express.static('../public'))

// 404 route handling
app.get('*', (req: express.Request, res: express.Response) => {
    res.status(404).sendFile(path.resolve(__dirname, '../public/404.html'))
})

// Reference structures, not the full definition found in /assets
// Going to try and only keep the props that we actively use here
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
    [key: string]: any
}

interface Game {
    players: Array<Player>
    join(id: string): void
    [key: string]: any
}

const games: Array<Game> = []
const players: { [socketID: string]: Game } = {}
let isGameWaitingForPlayers: boolean = false

io.on('connection', (socket: Socket) => {
    console.info(`Socket Connected: ${socket.id}`)

    socket.on('join', () => {
        // At some point we will need user data such as some sort of session cookie to determine whose playing
        if (isGameWaitingForPlayers) {
            games[games.length - 1].join(socket.id)
            isGameWaitingForPlayers = false
        } else {
            // Create and join a new game instance
            const newGame = new Game()
            games.push(newGame)
            games[games.length - 1].join(socket.id)
            isGameWaitingForPlayers = true
        }
        players[socket.id] = games[games.length - 1]
        const firstTurn: boolean = players[socket.id].players[0].id === socket.id
        socket.emit('confirm', 'Joined game', firstTurn)
        // If isGameWaitingForPlayers is false that means that at the beginning of this event it was true meaning the game is now ready to start
        if (!isGameWaitingForPlayers) {
            socket.emit('start', players[socket.id].players.find(p => p.id === socket.id))
            // Let opponent know the game has started
            io.sockets.sockets.get(players[socket.id].players.find(p => p.id !== socket.id).id).emit('start', players[socket.id].players.find(p => p.id !== socket.id))
        }
    })

    socket.on('draw', async (data: { isGenStartup: boolean | null, count?: number } | null) => {
        console.warn('Draw call')
        const game = players[socket.id]
        const newCard = await game.drawCard(socket.id)
        if (/*newCard instanceof Error || */newCard === null) {
            socket.emit('err', `An error occured | ACTION: Draw Card\nSocket: ${socket.id}`)
        } else {
            const itemCheck = newCard.typings?.isItem ? `${newCard.checkForCanBePlayed}` : null
            socket.emit('newCard', newCard, itemCheck)
            // This logic is redundant, fix later
            const opponent = game.players.find(p => p.id !== socket.id)
            if (!data?.isGenStartup) io.sockets.sockets.get(opponent.id).emit('opponentDraw')
        }
    })

    socket.on('checkForLegalPlay', (data: { cName: string }, ack: (res: { status: boolean }) => void) => {
        // Check that the card trying to be played is an actual card, is the players turn, and the player has enough energy to play it
        let legal = true
        const game = players[socket.id]
        const player = game.players.find(p => p.id === socket.id)
        const isValidCard = cardList[Object.keys(cardList).find((cardObjectName: string) => cardList[cardObjectName].name.toLowerCase() === data.cName.toLowerCase())]

        if (!isValidCard || player.energy < isValidCard.cost) legal = false

        ack({ status: legal })
    })

    socket.on('play', async (data: { cName: string, attackingCard: Card | null, defendingCard: Card | null }) => {
        const validCard: any = Object.values(cardList).find((card: { name: string }) => card.name.toLowerCase() === data.cName.toLowerCase())
        const game = players[socket.id]
        const player = game.players.find(p => p.id === socket.id)
        // If we have a valid card object, game object, and its the players turn
        if (validCard && game && player.isTakingTurn) {
            const playResult = game.playCard(validCard, socket.id)
            if (!playResult) return socket.emit('err', 'Failed to play, insufficient resources')
            // If an item is played we need to inform both players of its result
            const itemRes = validCard.typings?.isItem
                ? await validCard.action(data.attackingCard,
                    data.defendingCard,
                    game,
                    data.attackingCard?.name 
                        ? data.attackingCard?.name.split('_')[1] || 1 
                        : null,
                    data.defendingCard?.name 
                        ? data.defendingCard?.name.split('_')[1] || 1 
                        : null)
                : null
            if (validCard.typings?.isItem) socket.emit('itemPlayed', {card: validCard, itemActionRes: itemRes})
            // Tell the client new info so they can update accordingly
            socket.emit('updateResourceEngine', player)
            // Tell opponent that a card was played
            const opponent = game.players.find(p => !p.isTakingTurn)
            io.sockets.sockets.get(opponent.id).emit('opponentPlay', { card: validCard, itemRes: itemRes })
        } else {
            return socket.emit('err', 'Invalid play condition')
        }
    })

    socket.on('turn-end', (startingHandGenerated: boolean = true) => {
        console.warn('turn-end event')
        const game = players[socket.id]
        game.endTurn(startingHandGenerated)
        const defender = game.players.find(player => player.id !== socket.id)
        io.sockets.sockets.get(defender.id).emit('turn-ended')
        // Updating the player energy in the game state is in Game#endTurn(), this is to tell the clients to update their own game state and ui
        if (startingHandGenerated) {
            socket.emit('updateResourceEngine', game.players.find(p => p.id === socket.id))
            io.sockets.sockets.get(defender.id).emit('updateResourceEngine', defender)
        }
    })

    socket.on('attack', async (data: { attackingCard?: Card, defendingCard?: Card, attackingCardCount?: number, defendingCardCount?: number }) => {
        const game = players[socket.id]
        const attacker = game.players.find(p => p.id === socket.id)
        const defender = game.players.find(p => p.id !== socket.id)
        const cardAction = cardList[Object.keys(cardList).find((name: string) => name.toUpperCase() === data.attackingCard?.name.toUpperCase() )].action

        if (attacker.isTakingTurn && data.defendingCard?.attack && data.defendingCard?.health) {
            // Call action method and return result
            const res = await cardAction(data.attackingCard, data.defendingCard, game, data.attackingCardCount, data.defendingCardCount)
            if (res instanceof Error) {
                console.error(res)
                socket.emit('err', 'Attack event failed')
                return
            }
            // Send result back to client and opponent
            socket.emit('attackResult', res, data.attackingCardCount, data.defendingCardCount)
            io.sockets.sockets.get(defender.id).emit('attackResult', res, data.attackingCardCount, data.defendingCardCount)
            const gameOver = game.checkGameOver()
            if (gameOver) {
                socket.emit('gameOver', gameOver)
                io.sockets.sockets.get(defender.id).emit('gameOver', gameOver)
            }
        } else {
            socket.emit('err', 'One or more conditions failed for attack event')
        }
    })

    socket.on('disconnect', () => {
        console.info(`Socket Disconnected: ${socket.id}`)
        // Clear any player data from the game instance, then alert the remaining player, if there is one, that the game has ended
        try {
            io.sockets.sockets.get(players[socket.id].players.find(p => p.id !== socket.id).id).emit('playerLeft')
        } catch (error) {/* Theres no need to do anything with the error */}
        delete players[socket.id]
        const index = games.findIndex(game => game.players.find(player => player.id === socket.id))
        // If index exists, then the game object exists in the games array
        if (index >= 0) {
            const playerIndex = games[index].players.findIndex(player => player.id === socket.id)
            games[index].players.splice(playerIndex, 1)
            games.splice(index, 1)
        }
    })
})

http.listen(process.argv[2] || 8080, console.info(`Online!\n${Object.keys(cardList).length} cards loaded`))