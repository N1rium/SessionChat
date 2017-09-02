var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);

/* The prefix that acts as a command */
const CMD_PREFIX = '/';

/* The room which users automatically joins on login */
const DEFAULT_ROOM = "Global";

/* List of supported CMDS that will be sent to user upon connection */
const CMDS = [
    "rename",
];

/* How often to do a sweep check for cached users */
const CLEAR_USER_CACHE_INTERVAL = 1000 * 60 * 5;

/* TTL for how long users can be disconnected until released */
const USER_CACHE_TTL = 1000 * 60 * 5;

/* The main users object */
let users = {};

/* List of ids cached to remember disconnected users */
let userCache = [];

/* Internal reference to socket for convenience */
let _socket;

/* Setup static files catalogue  */
app.use(require("express").static(__dirname + "/dist"));

app.get("/", function(req, res) {
    res.sendFile(__dirname + "/index.html");
});

/* The main connection stream */
io.on("connection", function(socket) {
    _socket = socket;

    /*  Emits to all rooms on client */
    function emitClient(client, event, data) {
        client.rooms.forEach(function(room) {
            io.to(room).emit(event, data);
        });
    }

    /* Broadcasts to all rooms on client */
    function broadcastClient(client, event, data) {
        client.rooms.forEach(function(room) {
            io.to(room).broadcast(event, data);
        });
    }

    // socket.use(function(packet, next) {
    //     return next();
    // });

    socket.on("disconnect", function() {
        if(users[socket.id]) {
            console.log(users[socket.id].username + " has disconnected");
            io.emit("userleft", users[socket.id]);
            userCache.push({
                "id" : socket.id,
                "ttl" : Date.now() + USER_CACHE_TTL,
                "user" : users[socket.id]
            });
            delete users[socket.id];
        }
    });

    socket.on("chatmsg", function(msg, room = DEFAULT_ROOM) {
        if(!handleCommands(msg)) {
            io.to(room).emit("chatmsg", {
                "message" : msg,
                "user" : users[socket.id],
                "date" : new Date(),
            });
        }
    });

    socket.on("istyping", function() {
        io.broadcast.emit("istyping", users[socket.id].username);
    });

    socket.on("register", function(name) {
        newUser(name);
        welcome(socket);
    });

    socket.on("getcacheduser", function(id) {
        userCache.forEach(function(obj) {
            if(obj.id == id) {
                obj.user.id = socket.id;
                users[socket.id] = obj.user;
                newUser(obj.user.username);
                welcome(socket);
            }
        });
    });

    socket.on("renameuser", function(name) {
        renameUser(name);
    });
});

/* Checks msg param for command prefix and handles it accordingly */
function handleCommands(msg) {
    let id = _socket.id;
    if(msg.indexOf(CMD_PREFIX) != 0)
        return false;

    try {
        let cmd = msg.match("\/[a-zA-Z]+")[0].toLowerCase();
        let value = msg.split(cmd)[1].trim();
        let u = users[id];

        if(cmd == "/rename") {
            renameUser(value);
            return true;
        }
    } catch(e) {
        return false;
    }

    return false;
}

/* Joins default room and welcomes newly connected users */
function welcome(socket) {
    joinRoom(DEFAULT_ROOM);
    var obj = {
        "users" : users,
        "self" : users[socket.id],
    };
    io.to(socket.id).emit("welcome", obj, socket.id);
}

/* Basically creates and adds a new user object */
function newUser(name) {
    let id = _socket.id;
    console.log("Creating new user with username: ", name);
    users[id] = {"id" : id, "username" : name };
    io.emit("newuser", users[id]);
}

/* Renames a user */
function renameUser(name) {
    let id = _socket.id;
    let u = users[id];
    console.log("Renaming user: " + u.username + " with new username: ", name);
    io.emit("rename", {
        "name" : name,
        "user" : u,
    });
    u.username = name;
}

/* Joins room and emits event */
function joinRoom(room) {
    _socket.join(room);
    io.to(room).emit("joinedroom", room);
}

/* Checks user cache for passed TTLs and clears accordingly */
function sweepUserCache() {
    let start = Date.now();
    let count = 0;
    for(var i = 0; i < userCache.length; i++) {
        var u = userCache[i];
        if(u.ttl < Date.now()) {
            count++;
            userCache.splice(i,1);
            i--;
        }
    }
    console.log("Sweep: ", count, " entries cleared in ", Date.now() - start, "ms");
}

/* Sweep poll */
setInterval(function() {
    sweepUserCache();
}, CLEAR_USER_CACHE_INTERVAL);

http.listen(3000, function() {
    console.log("listening on *:3000");
});
