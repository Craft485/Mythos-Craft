import * as express from 'express'
const app = express()
const http = require('http').createServer(app)
const io = require('socket.io')(http)
import * as cookieParser from 'cookie-parser'
import * as bodyParser from 'body-parser'
import * as charmap from './charmap.json'
import * as config from './config.json'
import * as morgan from 'morgan'
import * as argon from 'argon2'
import * as mysql from 'mysql'
import * as path from 'path'
import * as uuid from 'uuid'

const connection = mysql.createConnection({
    host: config.mysql.host,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    multipleStatements: true
})

// @ts-ignore
import { Game, _cardList as cardList } from './assets.js'
import { Socket } from 'socket.io'

const DEBUG_DECK: { [name: string]: number } = {}

for (const entry in cardList) DEBUG_DECK[entry] = 2 
const STRING_DEBUG_DECK = JSON.stringify(DEBUG_DECK)

// f(x) = x / (L + C) where x is exp to next level, L is current level, and C is some constant
const C = 10

function calculateLevelProgress(exp: number, currentLevel: number): number {
    return exp / ( currentLevel + C )
}

function calculateLevelProgressRollover(progressToNextLevel: number, currentLevel: number): number {
    return progressToNextLevel * ( currentLevel + C )
}

app.use(morgan(':remote-addr :method :url :status :response-time ms :res[content-length]'))
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static('../public'))
app.use(cookieParser(config.cookie_secret))

// 404 route handling
app.get('*', (req: express.Request, res: express.Response) => {
    res.status(404).sendFile(path.resolve(__dirname, '../public/404.html'))
})

app.post('/login', async (req: express.Request, res: express.Response) => {
    connection.query('SELECT * FROM users WHERE username = ?;', 
    [req.body.username], 
    (err, results) => {
        if (err) { 
            console.error(err)
            return res.sendStatus(500)
        }

        if (results?.length > 0) {
            // Verify password
            argon.verify(results[0].password, req.body.password).then(async (success: boolean) => {
                if (success) {
                    const id = await uuid.v4()
                    connection.query('UPDATE users SET uuid = ? WHERE username = ?;', [id, req.body.username], (err) => {
                        if (err) {
                            console.error(err)
                            return res.sendStatus(500)
                        }
                        res.cookie('rememberme', id, { httpOnly: true, signed: true }).redirect('../profile')
                    })
                } else {
                    res.send('incorrect username/password')
                }
            })
        } else {
            // failed to login
            res.send('Unknown user')
        }
    })
})

app.post('/login/signup', (req: express.Request, res: express.Response) => {
    connection.query('SELECT username FROM users WHERE username = ?;', [req.query.u], async (err, results) => {
        if (err) { 
            console.error(err)
            return res.status(500).send({ status: 'Internal server error', success: false })
        }

        if (results?.length > 0) {
            // username already in use
            res.status(412).send({ status: 'user alerady exists', success: false })
        } else {
            // Add user to DB
            connection.query(`INSERT INTO users (username, password) VALUES(?, ?); 
            INSERT INTO inventory (cards) VALUES(?); 
            INSERT INTO decks (userID, name, cards) VALUES(LAST_INSERT_ID(), ?, ?);`, 
            // @ts-ignore Linter doesn't know what to expect of the query object
            [req.query.u, await argon.hash(req.query.p, { hashLength: 50 }), STRING_DEBUG_DECK, 'Starter Deck', STRING_DEBUG_DECK], 
            async (err) => {
                if (err) {
                    console.error(`Error adding new user: ${err}`)
                    return res.status(500).send({ status: 'Internal server error', success: false })
                }
                const id = await uuid.v4()
                connection.query('UPDATE users SET uuid = ? WHERE username = ?;', [id, req.query.u], (err) => {
                    if (err) {
                        console.error(err)
                        return res.status(500).send({ status: 'Internal server error', success: false })
                    }
                    res.cookie('rememberme', id, { httpOnly: true, signed: true }).redirect('../profile')
                })
            })
        }
    })
})

app.post('/profile/cardlist', (req: express.Request, res: express.Response) => {
    console.log(req.signedCookies)
    // Query db based off uuid in signed cookies
    if (!req.signedCookies.rememberme) return res.send({ status: 'User not logged in', state: 0, success: false })
    connection.query('SELECT id, username, preferences, selectedDeck, exp, level, gamesWon, gamesPlayed FROM users WHERE uuid = ?;', [req.signedCookies.rememberme], (err, userData) => {
        if (err) {
            console.error(err)
            return res.status(500).send({ status: 'Internal server error', state: -1, success: false })
        }

        const { id } = userData[0]
        connection.query('SELECT cards, orichalcum FROM inventory WHERE id = ?; SELECT * FROM decks WHERE userID = ?;', [id, id], (err, data) => {
            if (err) {
                console.error(err)
                return res.status(500).send({ status: 'Internal server error', state: -1, success: false })
            }
            userData[0].expForNextLevel = calculateLevelProgressRollover(1, userData[0].level)
            return res.send({ status: { cardList: cardList, inventory: JSON.parse(data[0][0].cards), orichalcum: data[0][0].orichalcum, deckData: data[1], userData: userData[0] }, state: 1, success: true })
        })
    })
})

app.post('/profile/addCardToDeck', (req, res) => {
    // Check for valid request
    if (!req.signedCookies.rememberme) return res.status(400).send({ status: 'User not logged in', state: 0,  success: false })

    const { cardName, deckName } = req.query
    connection.query('SELECT id FROM users WHERE uuid = ?;', [req.signedCookies.rememberme], (err, userData) => {
        if (err) {
            console.error(err)
            return res.status(500).send({ status: 'Internal server error', state: -1, success: false })
        }
        const { id } = userData[0]
        connection.query('SELECT * FROM inventory WHERE id = ?; SELECT * FROM decks WHERE userID = ? AND name = ?;', [id, id, deckName], (err, data) => {
            if (err) {
                console.error(err)
                return res.status(500).send({ status: 'Internal server error', state: -1, success: false })
            }
            const cards = JSON.parse(data[0][0].cards)
            const deckData = JSON.parse(data[1][0].cards) || null
            const validCardNameInInventory = Object.keys(cards).find(name => name === cardName)
            if (validCardNameInInventory) {
                if (!deckData) return res.status(400).send({ status: 'Invalid deck name', state: -2, success: false })
                // Check that the user is able to add the card(they have enough remaining in their inventory)
                const cardCountInDeck = deckData[validCardNameInInventory] || 0
                const cardCountInInventory = cards[validCardNameInInventory]
                
                if (cardCountInInventory > cardCountInDeck) {
                    cardCountInDeck > 0 ? deckData[validCardNameInInventory]++ : deckData[validCardNameInInventory] = 1
                    connection.query('UPDATE decks SET cards = ? WHERE userID = ? AND name = ?;', [JSON.stringify(deckData), id, deckName], err => {
                        if (err) {
                            console.error(err)
                            return res.status(500).send({ status: 'Internal server error', state: -1, success: false })
                        } else {
                            return res.status(200).send({ status: 'Success', state: 1, success: true })
                        }
                    })
                } else {
                    return res.status(400).send({ status: 'Not enough cards', state: -2, success: false })
                }
            } else {
                return res.status(400).send({ status: 'Unknown card name', state: -2, success: false })
            }
        })
    })
})

app.post('/profile/removeCardFromDeck', (req, res) => {
    if (!req.signedCookies.rememberme) return res.status(400).send({ status: 'User not logged in', state: 0,  success: false })

    const { cardName, deckName } = req.query
    connection.query('SELECT id FROM users WHERE uuid = ?;', [req.signedCookies.rememberme], (err, userData) => {
        if (err) {
            console.error(err)
            return res.status(500).send({ status: 'Internal server error', state: -1, success: false })
        }
        const { id } = userData[0]
        connection.query('SELECT * FROM decks WHERE userID = ? AND name = ?;', [id, deckName], (err, deckData) => {
            if (err) {
                console.error(err)
                return res.status(500).send({ status: 'Internal server error', state: -1, success: false })
            }
            const cards = JSON.parse(deckData[0].cards) || null
            const validCardName = Object.keys(cards).find(name => name === cardName)
            if (validCardName && cards) {
                // If we are removing the last card then remove the entry for the card in the deck object
                cards[validCardName] > 1 ? cards[validCardName]-- : delete cards[validCardName]
                connection.query('UPDATE decks SET cards = ? WHERE userID = ? AND name = ?;', [JSON.stringify(cards), id, deckName], err => {
                    if (err) {
                        console.error(err)
                        return res.status(500).send({ status: 'Internal server error', state: -1, success: false })
                    } else {
                        return res.status(200).send({ status: 'Success', state: 1, success: true })
                    }
                })
            } else {
                return res.status(400).send({ status: 'Invalid card/deck name', state: -2, success: false })
            }
        })
    })
})

app.post('/profile/signout', (req: express.Request, res: express.Response) => { if (req.signedCookies.rememberme) connection.query('UPDATE users SET uuid = null WHERE uuid = ?;', [req.signedCookies.rememberme], err => { if (err) { console.error(err) }; res.clearCookie('rememberme').sendStatus(200) }) })

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
    socketID: string
    energy: number
    health: number
    [key: string]: any
}

interface Game {
    players: Array<Player>
    join(socketID: string, id: string, cardData: string, playerName: string): void
    [key: string]: any
}

function decode(s: string): string {
    for (const [value, code] of Object.entries(charmap)) s = s.replaceAll(code, value)
    return s
}

const games: Array<Game> = []
const players: { [socketID: string]: Game } = {}
let isGameWaitingForPlayers: boolean = false

io.on('connection', (socket: Socket) => {
    console.info(`Socket Connected: ${socket.id}`)
    let globalPlayerID: string | number
    socket.on('join', () => {
        // Verify user
        const originalCookie = decode(`${socket.handshake.headers.cookie}`.split('; ').find(e => e.toLowerCase().startsWith('rememberme')).replace('rememberme=', '')) || null
        const validCookie = originalCookie ? cookieParser.signedCookie(originalCookie, config.cookie_secret) : null
        // Check cookie and uuid
        const validUUID = uuid.validate(validCookie)
        const validUUIDVersion = uuid.version(validCookie) === 4
        if (validCookie && validCookie !== originalCookie && validUUID && validUUIDVersion) {
            // Valid session and uuid
            connection.query('SELECT id, selectedDeck, username FROM users WHERE uuid = ?;', [validCookie], (err, userData) => {
                if (err) {
                    console.error(err)
                    socket.emit('err', 'DB: Server Error')
                    return
                }
                console.log(userData)
                const { id, selectedDeck, username:playerName } = userData[0]
                globalPlayerID = id
                connection.query('SELECT cards FROM decks WHERE userID = ? AND name = ?;', [id, selectedDeck], (err, deckData) => {
                    if (err) {
                        console.error(err)
                        socket.emit('err', 'DB: Server Error')
                        return
                    }

                    console.log(deckData)
                    const { cards } = deckData[0]
                    console.log(cards)
                    if (isGameWaitingForPlayers) {
                        games[games.length - 1].join(socket.id, id, cards, playerName)
                        isGameWaitingForPlayers = false
                    } else {
                        // Create and join a new game instance
                        const newGame = new Game()
                        games.push(newGame)
                        games[games.length - 1].join(socket.id, id, cards, playerName)
                        isGameWaitingForPlayers = true
                    }
                    players[socket.id] = games[games.length - 1]
                    // Same to compare global user ids here because it is not possible for them to be 0
                    const firstTurn: boolean = players[socket.id].players[0].id === id
                    socket.emit('confirm', 'Joined game', firstTurn)
                    // If isGameWaitingForPlayers is false that means that at the beginning of this event it was true meaning the game is now ready to start
                    if (!isGameWaitingForPlayers) {
                        socket.emit('start', players[socket.id].players.find(p => p.id === id))
                        // Let opponent know the game has started
                        io.sockets.sockets.get(players[socket.id].players.find(p => p.id !== id).socketID).emit('start', players[socket.id].players.find(p => p.id !== id))
                    }
                })
            })
        } else {
            // Invalid session or user
            socket.emit('redirect', 'login')
            return
        }
    })

    socket.on('draw', async (data: { isGenStartup: boolean | null, count?: number } | null) => {
        console.warn('Draw call')
        const game = players[socket.id]
        const newCard = await game.drawCard(globalPlayerID)
        if (/*newCard instanceof Error || */newCard === null) {
            socket.emit('err', `An error occured | ACTION: Draw Card\nSocket: ${socket.id}`)
        } else {
            const itemCheck = newCard.typings?.isItem ? `${newCard.checkForCanBePlayed}` : null
            socket.emit('newCard', newCard, itemCheck)
            // This logic is redundant, fix later
            const opponent = game.players.find(p => p.id !== globalPlayerID)
            if (!data?.isGenStartup) io.sockets.sockets.get(opponent.socketID).emit('opponentDraw')
        }
    })

    socket.on('checkForLegalPlay', (data: { cName: string }, ack: (res: { status: boolean }) => void) => {
        // Check that the card trying to be played is an actual card, is the players turn, and the player has enough energy to play it
        let legal = true
        const game = players[socket.id]
        const player = game.players.find(p => p.id === globalPlayerID)
        const isValidCard = cardList[Object.keys(cardList).find((cardObjectName: string) => cardList[cardObjectName].name.toLowerCase() === data.cName.toLowerCase())]

        if (!isValidCard || player.energy < isValidCard.cost) legal = false

        ack({ status: legal })
    })

    socket.on('play', async (data: { cName: string, attackingCard: Card | null, defendingCard: Card | null }) => {
        const validCard: any = Object.values(cardList).find((card: { name: string }) => card.name.toLowerCase() === data.cName.toLowerCase())
        const game = players[socket.id]
        const player = game.players.find(p => p.id === globalPlayerID)
        // If we have a valid card object, game object, and its the players turn
        if (validCard && game && player.isTakingTurn) {
            const playResult = game.playCard(validCard, globalPlayerID)
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
            io.sockets.sockets.get(opponent.socketID).emit('opponentPlay', { card: validCard, itemRes: itemRes })
        } else {
            return socket.emit('err', 'Invalid play condition')
        }
    })

    socket.on('turn-end', (startingHandGenerated: boolean = true) => {
        console.warn('turn-end event')
        const game = players[socket.id]
        game.endTurn(startingHandGenerated)
        const defender = game.players.find(player => player.id !== globalPlayerID)
        io.sockets.sockets.get(defender.socketID).emit('turn-ended')
        // Updating the player energy in the game state is in Game#endTurn(), this is to tell the clients to update their own game state and ui
        if (startingHandGenerated) {
            socket.emit('updateResourceEngine', game.players.find(p => p.id === globalPlayerID))
            io.sockets.sockets.get(defender.socketID).emit('updateResourceEngine', defender)
        }
    })

    socket.on('attack', async (data: { attackingCard?: Card, defendingCard?: Card, attackingCardCount?: number, defendingCardCount?: number }) => {
        console.log(data)
        const game = players[socket.id]
        const attacker = game.players.find(p => p.id === globalPlayerID)
        const defender = game.players.find(p => p.id !== globalPlayerID)
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
            io.sockets.sockets.get(defender.socketID).emit('attackResult', res, data.attackingCardCount, data.defendingCardCount)
            const gameOver = game.checkGameOver()
            if (gameOver) {
                let opponentLevelUp = false
                let playerLeveledUp = false
                connection.query('SELECT * FROM users WHERE id = ?; SELECT * FROM users WHERE id = ?;', [globalPlayerID, defender.id], (err, data) => {
                    if (err) {
                        console.error(err)
                        socket.emit('gameOver', null)
                        io.sockets.sockets.get(defender.socketID).emit('gameOver', null)
                        return
                    }

                    const player = data[0][0]
                    const opponent = data[1][0]
                    // TODO: Move away from hard coded exp reward values
                    let playerExpCount = player.exp + gameOver[gameOver.w.player.id === globalPlayerID ? 'w' : 'l'].exp
                    let opponentExpCount = opponent.exp + gameOver[gameOver.w.player.id !== globalPlayerID ? 'w' : 'l'].exp
                    const playerLevelProgress = calculateLevelProgress(playerExpCount, player.level)
                    const opponentLevelProgress = calculateLevelProgress(opponentExpCount, opponent.level)
                    playerLeveledUp = playerLevelProgress >= 1
                    opponentLevelUp = opponentLevelProgress >= 1
                    if (playerLeveledUp) playerExpCount = calculateLevelProgressRollover(playerLevelProgress - 1, player.level)
                    if (opponentLevelUp) opponentExpCount = calculateLevelProgressRollover(opponentLevelProgress - 1, opponent.level)
                    connection.query('UPDATE users SET level = level + ?, exp = ?, gamesPlayed = gamesPlayed + 1, gamesWon = gamesWon + ? WHERE id = ?; UPDATE users SET level = level + ?, exp = ?, gamesPlayed = gamesPlayed + 1, gamesWon = gamesWon + ? WHERE id = ?; UPDATE inventory SET orichalcum = orichalcum + ? WHERE id = ?; UPDATE inventory SET orichalcum = orichalcum + ? WHERE id = ?;',
                    [
                        Math.floor(playerLevelProgress), playerExpCount, gameOver.w.player.id === globalPlayerID ? 1 : 0, globalPlayerID, 
                        Math.floor(opponentLevelProgress), opponentExpCount, gameOver.w.player.id !== globalPlayerID ? 1 : 0, defender.id,
                        gameOver.w.player.id === globalPlayerID ? 10 : 3, globalPlayerID,
                        gameOver.w.player.id !== globalPlayerID ? 10 : 3, defender.id
                    ],
                    err => {
                        if (err) {
                            console.error(err)
                            socket.emit('gameOver', null)
                            io.sockets.sockets.get(defender.socketID).emit('gameOver', null)
                            return
                        }
                        socket.emit('gameOver', gameOver, playerLeveledUp)
                        io.sockets.sockets.get(defender.socketID).emit('gameOver', gameOver, opponentLevelUp)
                    })
                })
            }
        } else {
            socket.emit('err', 'One or more conditions failed for attack event')
        }
    })

    socket.on('disconnect', () => {
        console.info(`Socket Disconnected: ${socket.id}`)
        // Clear any player data from the game instance, then alert the remaining player, if there is one, that the game has ended
        try {
            io.sockets.sockets.get(players[socket.id].players.find(p => p.id !== globalPlayerID).socketID).emit('playerLeft')
        } catch (error) {/* Theres no need to do anything with the error */}
        delete players[socket.id]
        const index = games.findIndex(game => game.players.find(player => player.id === globalPlayerID))
        // If index exists, then the game object exists in the games array
        if (index >= 0) {
            const playerIndex = games[index].players.findIndex(player => player.id === globalPlayerID)
            games[index].players.splice(playerIndex, 1)
            games.splice(index, 1)
        }
    })
})

// Heartbeat connection to DB
connection.query('SELECT 1;', err => { if (err) throw err; })
setInterval(() => {
    connection.query('SELECT 1;', err => { if (err) throw err })
}, 300000)

http.listen(process.argv[2] || config.PORT, console.info(`Online!\n${Object.keys(cardList).length} cards loaded`))