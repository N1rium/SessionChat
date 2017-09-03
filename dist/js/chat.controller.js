angular.module("SocketChat", []).controller("ChatController",
    ["$scope", "$timeout", function($scope, $timeout) {

    /* Map to hold keys used to communicate with SocketIO */
    const SOCKET_KEYS = {
        "ChatMessage"   : "chatmsg",
        "InputChanged"  : "istyping",
        "UserRename"    : "renameuser",
    };

    const MAX_FILE_SIZE = 20; //Maximum file size for image upload

    /* Class to represent a room */
    class Room {
        constructor(name) {
            this.name = name;
            this.messages = [];
        }
    }

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
        "users" : [], /* List of users */
        "typing" : [], /* List of people that are currently typing */
    };

    $scope.rooms = [];
    $scope.room = null;

    $scope.setRoom = function(room) {
        $scope.room = room;
    }

    $scope.getRoom = function(name) {
        for(let i = 0; i < $scope.rooms.length; i++) {
            var room = $scope.rooms[i];
            if(room.name == name)
                return room;
        }
        return null;
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

    $scope.addRoom = function(name) {
        for(let i = 0; i < $scope.rooms.length; i++) {
            let r = $scope.rooms[i];
            if(r.name == name)
                return;
        }
        $scope.rooms.push(new Room(name));
    }

    socket.on("chatmsg", function(data) {
        $scope.$apply(function() {
            console.log("Data", data);
            $scope.getRoom(data.room).messages.push(data);
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
            $scope.setRoom($scope.room || $scope.rooms[0]);
        });
    });

    socket.on("rename", function(data) {
        for(let i = 0; i < $scope.rooms.length; i++) {
            for(let j = 0; j < $scope.room.messages.length; j++) {
                let obj = $scope.rooms[i].messages[j];
                if(obj["user"].id == data["user"].id) {
                    $scope.$apply(function() {
                        obj["user"]["username"] = data["name"];
                    });
                }
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

    function err(reason) {
        console.warn(reason);
    }

    socket.on("error", function(reason) {
        err(reason);
    });

    $scope.register = function() {
        if(!$scope.username || !$scope.username.length) {
            err("Insufficient username!");
            return;
        }
        socket.emit("register", $scope.username);
    }

    $scope.chatScrollBottom = function() {
        let e = document.getElementById("chatscroll");
        e.scrollTop = e.scrollHeight;
    }

    $scope.send = function() {
        socket.emit(SOCKET_KEYS["ChatMessage"], $scope.chatmsg, $scope.room.name);
        $scope.chatmsg = "";
    }

    $scope.inputChange = function(value) {
        socket.emit(SOCKET_KEYS["InputChanged"], value);
    }

    /* Destruction! */
    $scope.$on("destroy", function() {

    });

    /* Preview image on login screen */
    $scope.previewImage = null;

    /* Tied to input[type="file"] onchange handler */
    $scope.uploadImage = function(event) {
        var file = event.target.files[0];
        var filesize = Math.round(file.size / 1024);

        /* Client side size validation */
        if(filesize > MAX_FILE_SIZE) {
            err("File is too big, was: ~"
            + filesize
            + "kb. Maximum size allowed is: "
            + MAX_FILE_SIZE + "kb.");
            return;
        }

        var reader = new FileReader();
        //TODO - start loader for upload
        reader.onload = function(event) {
            //TODO - stop loader for upload
            $scope.$apply(function() {
                $scope.previewImage = event.target.result;
            });
         };

         reader.readAsDataURL(file);
    }

    try {
        var sc = localStorage.getItem("socketcache");
        console.log("SC: ", sc);
        if(sc)
            socket.emit("getcacheduser", sc);
    } catch(e) {

    }

}]);
