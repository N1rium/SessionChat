angular.module("SocketChat", []).controller("ChatController",
    ["$scope", "$timeout", function($scope, $timeout) {

    /* Map to hold keys used to communicate with SocketIO */
    const SOCKET_KEYS = {
        "ChatMessage"   : "chatmsg",
        "InputChanged"  : "inputchanged",
        "UserRename"    : "renameuser",
    };

    var sentMessages = [];
    let socket;

    function connectIO() {
        if(socket)
            return;
        try {
            socket = io();
        } catch(e) {

        }
    }

    connectIO();

    $scope.chatData = {
        "self" : {},
        "messages" : [], /* List of messages */
        "rooms" : [], /* List of rooms */
        "users" : [], /* List of users */
        "typing" : [], /* List of people that are currently typing */
    };

    $scope.room = null;

    $scope.setRoom = function(room) {
        $scope.room = room;
    }

    $scope.createRoom = function(room, isPublic = true) {
        socket.emit("createroom", {
            "name" : room,
            "public" : isPublic,
        });
    }

    function addUser(user) {
        for(let i = 0; i < $scope.chatData.users.length; i++) {
            let u = $scope.chatData.users[i];
            if(u.id == user.id)
                return;
        }
        $scope.chatData.users.push(user);
    }

    $scope.addRoom = function(room) {
        for(let i = 0; i < $scope.chatData.rooms.length; i++) {
            let r = $scope.chatData.rooms[i];
            if(r == room)
                return;
        }
        $scope.chatData.rooms.push(room);
    }

    socket.on("chatmsg", function(data) {
        $scope.$apply(function() {
            $scope.chatData.messages.push(data);
            $timeout(function() {
                $scope.chatScrollBottom();
            }, 10);
        });
    });

    socket.on("welcome", function(data, id) {
        $scope.$apply(function() {
            for (var key in data.users) {
                addUser(data.users[key]);
            }
        });

        try {
            localStorage.setItem("socketcache", id);
        } catch(e) {

        }

        $scope.$apply(function() {
            $scope.isLogin = true;
            $scope.chatData.self = data.self;
        });
    });

    socket.on("newuser", function(data) {
        $scope.$apply(function() {
            addUser(data);
        });
    });

    socket.on("userleft", function(data) {
        for(var i = 0; i < $scope.chatData.users.length; i++) {
            var u = $scope.chatData.users[i];
            if(u.id == data.id) {
                $scope.$apply(function() {
                    $scope.chatData.users.splice(i,1);
                });
                break;
            }
        }
    });

    socket.on("roomcreated", function(room) {
        $scope.$apply(function() {
            $scope.addRoom(room);
        });
    });

    socket.on("joinedroom", function(data) {
        $scope.$apply(function() {
            $scope.addRoom(data);
            $scope.setRoom($scope.room || data);
        });
    });

    socket.on("leftroom", function(data) {
        for(var i = 0; i < $scope.chatData.rooms.length; i++) {
            var r = $scope.chatData.rooms[i];
            if(r == data) {
                $scope.$apply(function() {
                    $scope.chatData.rooms.splice(i,1);
                });
                break;
            }
        }
    });

    socket.on("rename", function(data) {
        for(let i = 0; i < $scope.chatData.messages.length; i++) {
            let obj = $scope.chatData.messages[i];
            if(obj["user"].id == data["user"].id) {
                $scope.$apply(function() {
                    obj["user"]["username"] = data["name"];
                });
            }
        }

        for(let i = 0; i < $scope.chatData.users.length; i++) {
            let obj = $scope.chatData.users[i];
            if(obj.id == data.user.id) {
                $scope.$apply(function() {
                    obj.username = data.name;
                });
            }
        }
    });

    $scope.register = function() {
        socket.emit("register", $scope.username);
    }

    $scope.chatScrollBottom = function() {
        let e = document.getElementById("chatscroll");
        e.scrollTop = e.scrollHeight;
    }

    $scope.send = function() {
        socket.emit(SOCKET_KEYS["ChatMessage"], $scope.chatmsg);
        sentMessages.push($scope.chatmsg);
        $scope.chatmsg = "";
    }

    $scope.inputChange = function(value) {
        //socket.emit(SOCKET_KEYS["InputChanged"], value);
    }

    /* Destruction! */
    $scope.$on("destroy", function() {

    });

    try {
        var sc = localStorage.getItem("socketcache");
        console.log("SC: ", sc);
        if(sc)
            socket.emit("getcacheduser", sc);
    } catch(e) {

    }

}]);
