const http = require("http");
const app = require("express")();
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"))

app.listen(9091, () => console.log("Listening on http port 9091"))
const websocketServer = require("websocket").server
const httpServer = http.createServer();
httpServer.listen(9090, () => console.log("Listening.. on 9090"))
//hashmap clients
const clients = {};
const games = {};

const wsServer = new websocketServer({
    "httpServer": httpServer
})
wsServer.on("request", request => {
    //connect
    const connection = request.accept(null, request.origin);
    connection.on("open", () => console.log("opened!"))
    connection.on("close", () => console.log("closed!"))
    connection.on("message", message => {
        const result = JSON.parse(message.utf8Data)

        //strat
        if (result.method === "createGame") {
            const clientId = result.clientId;
            const playerName = result.playerName;
            clients[clientId].name = playerName;

            const gameId = guid();
            games[gameId] = {
                "id": gameId,
                "balls": 20,
                "clients": [],
                "turn": 0,
                "cards": randCards()
            }

            const payLoad = {
                "method": "createGame",
                "game": games[gameId]
            }

            const con = clients[clientId].connection;
            con.send(JSON.stringify(payLoad));
        }

        if (result.method === "startGame") {
            const gameId = result.gameId;

            const payLoad = {
                "method": "startGame",
                "game": games[gameId]
            }

            games[gameId].clients.forEach(c => {
                clients[c.clientId].connection.send(JSON.stringify(payLoad))
            })

        }

        if (result.method === "joinGame") {

            const clientId = result.clientId;
            const gameId = result.gameId;
            const game = games[gameId];
            const playerName = result.playerName;
            clients[clientId].name = playerName;

            if (game.clients.length >= 3) {
                //sorry max players reach
                return;
            }
            const color = { "0": "Red", "1": "Green", "2": "Blue" }[game.clients.length]
            const name = clients[clientId].name;
            game.clients.push({
                "clientId": clientId,
                "color": color,
                "name": name,
                "clientCards": game.cards.slice(0, 4),
                "tCards": -1,
                "opCard": -1
            })
            game.cards = game.cards.slice(4, game.cards.length);
            //start the game
            if (game.clients.length === 3) updateGameState();

            const payLoad = {
                "method": "joinGame",
                "game": game,
                "posInGame": game.clients.length - 1,
                "latestJoin": clientId
            }
            //loop through all clients and tell them that people has joined
            game.clients.forEach(c => {
                clients[c.clientId].connection.send(JSON.stringify(payLoad))
            })
        }

        if (result.method === "getStackCard") {
            const gameId = result.gameId;
            const cardValue = result.cardValue;
            const color = result.color;

            games[gameId].clients[games[gameId].turn].clientCards.push(cardValue);
            games[gameId].cards = games[gameId].cards.slice(1, games[gameId].cards.length);
            games[gameId].state = 1;
            console.log("got it");

            //next turn
            //games[gameId].turn = (games[gameId].turn + 1) % games[gameId].clients.length;

            const payLoad = {
                "method": "update",
                "game": games[gameId]
            }

            games[gameId].clients.forEach(c => {
                clients[c.clientId].connection.send(JSON.stringify(payLoad))
            })


            // let state = games[gameId].state;
            // if (!state)
            //     state = {}

            // state[ballId] = color;
            // games[gameId].state = state;

        }

        //==========================================================================================

        //I have received a message from the client
        //a user want to create a new game
        if (result.method === "create") {
            const clientId = result.clientId;
            const gameId = guid();
            games[gameId] = {
                "id": gameId,
                "balls": 20,
                "clients": []
            }

            const payLoad = {
                "method": "create",
                "game": games[gameId]
            }

            const con = clients[clientId].connection;
            con.send(JSON.stringify(payLoad));
        }

        if (result.method === "throwCard") {
            const clientId = result.clientId;
            const gameId = result.gameId;
            const vgame = games[gameId];
            const cardIndex = parseInt(result.cardIndex);
            const playerIndex = parseInt(result.playerIndex);
            const rCard = vgame.clients[vgame.turn].clientCards[cardIndex];
            vgame.clients[vgame.turn].clientCards.splice(cardIndex, 1);
            //next turn
            vgame.turn = (vgame.turn + 1) % vgame.clients.length;
            vgame.clients[vgame.turn].opCard = rCard;
            const payLoad = {
                "method": "update",
                "game": vgame
            }

            vgame.clients.forEach(c => {
                clients[c.clientId].connection.send(JSON.stringify(payLoad))
            })
        }

        //a client want to join
        if (result.method === "join") {

            const clientId = result.clientId;
            const gameId = result.gameId;
            const game = games[gameId];
            if (game.clients.length >= 3) {
                //sorry max players reach
                return;
            }
            const color = { "0": "Red", "1": "Green", "2": "Blue" }[game.clients.length]
            game.clients.push({
                "clientId": clientId,
                "color": color
            })
            //start the game
            if (game.clients.length === 3) updateGameState();

            const payLoad = {
                "method": "join",
                "game": game
            }
            //loop through all clients and tell them that people has joined
            game.clients.forEach(c => {
                clients[c.clientId].connection.send(JSON.stringify(payLoad))
            })
        }

        //a user plays
        if (result.method === "play") {
            const gameId = result.gameId;
            const ballId = result.ballId;
            const color = result.color;
            games[gameId].turn = (games[gameId].turn + 1) % games[gameId].clients.length;
            let state = games[gameId].state;
            if (!state)
                state = {}

            state[ballId] = color;
            games[gameId].state = state;

        }

        if (result.method === "setName") {
            const plyrID = result.plyrID;
            const name = result.name;
            clients[plyrID].name = "iman";
        }

    })

    //generate a new clientId
    const clientId = guid();
    clients[clientId] = {
        "connection": connection,
        "name": "Player"
    }

    const payLoad = {
        "method": "connect",
        "clientId": clientId
    }
    //send back the client connect
    connection.send(JSON.stringify(payLoad))

})


function updateGameState() {

    //{"gameid", fasdfsf}
    for (const g of Object.keys(games)) {
        const game = games[g]
        const payLoad = {
            "method": "update",
            "game": game
        }

        game.clients.forEach(c => {
            clients[c.clientId].connection.send(JSON.stringify(payLoad))
        })
    }

    setTimeout(updateGameState, 500);
}



function S4() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

// then to call it, plus stitch in '4' in the third group
const guid = () => (S4() + S4() + "-" + S4() + "-4" + S4().substr(0, 3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();

function randCards() {
    let l = 52;
    let arr = [];
    for (i = 1; i < 53; i++) arr.push(i);
    for (i = 0; i < 52; i++) {
        let rr = Math.floor(Math.random() * l);
        let t = arr[l - 1];
        arr[l - 1] = arr[rr];
        arr[rr] = t;
        l--;
    }
    return arr;
}
