const express = require("express");
const http = require("http");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const DB_FILE = "./db.json";

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const online = {};

function isLowercase(str) {
  return str === str.toLowerCase();
}

/* REGISTER */
io.on("connection", (socket) => {

  socket.on("register", (data, cb) => {
    const db = loadDB();

    const exists = db.users.find(u => u.username === data.username);

    if (exists) {
      return cb({ ok: false, msg: "User exists" });
    }

    if (!isLowercase(data.username)) {
      return cb({ ok: false, msg: "Username must be lowercase" });
    }

    if (data.password.length < 4) {
      return cb({ ok: false, msg: "Password too short" });
    }

    db.users.push(data);
    saveDB(db);

    cb({ ok: true });
  });

  /* LOGIN */
  socket.on("login", (data, cb) => {
    const db = loadDB();

    const user = db.users.find(
      u => u.username === data.username &&
           u.password === data.password
    );

    if (!user) {
      return cb({ ok: false, msg: "Invalid login" });
    }

    socket.username = data.username;
    online[data.username] = socket.id;

    cb({ ok: true, username: data.username });

    io.emit("online users", Object.keys(online));
  });

  /* SEARCH */
  socket.on("search", (name, cb) => {
    const db = loadDB();

    const found = db.users.find(u => u.username === name);

    if (!found) return cb({ ok: false });

    cb({ ok: true, online: !!online[name] });
  });

  /* GET INBOX */
  socket.on("get inbox", (username, cb) => {
    const db = loadDB();

    const chats = db.messages.filter(
      m => m.from === username || m.to === username
    );

    cb(chats);
  });

  /* DM */
  socket.on("dm", (data) => {
    const db = loadDB();

    const msg = {
      from: socket.username,
      to: data.to,
      msg: data.msg,
      time: Date.now()
    };

    db.messages.push(msg);
    saveDB(db);

    const target = online[data.to];

    if (target) {
      io.to(target).emit("dm", msg);
    }

    socket.emit("dm", msg);
  });

  /* CHANGE USERNAME */
  socket.on("change username", (data, cb) => {
    const db = loadDB();

    const user = db.users.find(u => u.username === socket.username);

    if (!user) return cb({ ok: false });

    user.username = data.newName;

    saveDB(db);

    cb({ ok: true });
  });

  /* CHANGE PASSWORD */
  socket.on("change password", (data, cb) => {
    const db = loadDB();

    const user = db.users.find(u => u.username === socket.username);

    if (!user) return cb({ ok: false });

    user.password = data.newPass;

    saveDB(db);

    cb({ ok: true });
  });

  /* LOGOUT */
  socket.on("logout", () => {
    delete online[socket.username];
    io.emit("online users", Object.keys(online));
  });

});

server.listen(3000, () => {
  console.log("FunChat PRO running on port 3000");
});
