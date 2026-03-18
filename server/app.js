var serveStatic = require('serve-static');
var app = require('connect')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(serveStatic(__dirname + '/../client'));
http.listen(process.env.PORT || 3000);

// game logic
var COLORS = ['red', 'blue', 'green'];
var SHAPES = ['polygon', 'rect', 'circle'];
var FILLS = ['none', 'lines', 'full'];
/**
 * Check whether 3 cards form a valid set.
 */
function isValidSet(a, b, c) {
    var props = ['color', 'shape', 'fill', 'count'];
    return props.every(function(p) {
        var allSame = a[p] === b[p] && b[p] === c[p];
        var allDiff = a[p] !== b[p] && b[p] !== c[p] && a[p] !== c[p];
        return allSame || allDiff;
    });
}

function boardHasValidSet(boardCards) {
    for (var i = 0; i < boardCards.length - 2; i++) {
        for (var j = i + 1; j < boardCards.length - 1; j++) {
            for (var k = j + 1; k < boardCards.length; k++) {
                if (isValidSet(boardCards[i], boardCards[j], boardCards[k])) return true;
            }
        }
    }
    return false;
}


/**
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 */
function shuffle(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

function getRandomProperties() {
	return {
		aColor: COLORS[getRandomInt(0,3)],
		aShape: SHAPES[getRandomInt(0,3)],
		aFill: FILLS[getRandomInt(0,3)],
		aCount: getRandomInt(1,4)
	}
}
function guidGenerator(prefix) {
    var S4 = function() {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return prefix + (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}
function getRandomInt(min, max) {
  	return Math.floor(Math.random() * (max - min)) + min;
}

//Player
function Player(socket) {
	this.pid = socket.id;
	this.name = socket.id;
	this.stats = {
		points: 0,
		badAttempts: 0,
		goodAttempts: 0
	};
	this.socket = socket;
}
//Card
function Card(props) {
	this.cid = guidGenerator('cid_');
	this.color = props.aColor;
	this.shape = props.aShape;
	this.fill = props.aFill;
	this.count = props.aCount;
}
//Deck
function Deck() {
	cards = [];
	COLORS.forEach(function(c) {
		SHAPES.forEach(function(s) {
			FILLS.forEach(function(f) {
				[1, 2, 3].forEach(function(count) {
					var card = new Card({
						aColor: c,
						aShape: s,
						aFill: f,
						aCount: count
					});
					cards.push(card);
				});
			});
		});
	});
	shuffle(cards);
	this.cards = cards;
}
Deck.prototype.draw = function (count) {
	var drawnCards = [];
	for (var i = count - 1; i >= 0; i--) {
		var c = this.cards.pop();
		if(c) { drawnCards.push(c); }
	};
	return drawnCards
}
//Session
var SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function Session() {
	this.sid = '#' + guidGenerator('sid_');
	this.status = 'active';
	this.activePlayer;
	this.deck = new Deck()
	this.board = {};
	this.players = {};
	this.turnTimeout = 3000;
	this.timeout = null;
	this.lastActivity = Date.now();

	var that = this;
	this.deck.draw(12).forEach(function (c) {
		that.board[c.cid] = c;
	});
}
Session.prototype.isSolution = function (cids) {

	function isValid(prop, cards) {
		return (cards[0][prop] === cards[1][prop] 
		&& cards[0][prop] === cards[2][prop])
		|| (cards[0][prop] !== cards[1][prop]
		&& cards[0][prop] !== cards[2][prop]
		&& cards[1][prop] !== cards[2][prop]);
	}

	var cards = [];
	try {
		cards.push(this.board[cids[0]]);
		cards.push(this.board[cids[1]]);
		cards.push(this.board[cids[2]]);
		return isValid('color', cards) && isValid('shape', cards) && isValid('fill', cards); 
	} catch(e) {
		console.log('WARNING: Didn\'t find all cards');
		return false;
	}
}
Session.prototype.addPlayer = function(socket) {
	var p = new Player(socket);
	this.players[socket.id] = p;
	return p
}
Session.prototype.removePlayer = function(pid) {
	try { delete this.player[pid]; }
	catch (e) { return false; }
	return true;
}
Session.prototype.getNumberOfPlayers = function() {
	return Object.keys(this.players).length;
}
Session.prototype.updateScoreForActivePlayer = function(reason) {
	var stats = this.players[this.activePlayer].stats;
	if(reason === 'good solution') {
		stats.points += 1;
		stats.goodAttempts += 1;
	} else if (reason === 'bad solution' || reason === 'countdown') {
		stats.points += -3;
		stats.badAttempts += 1
	}
	stats.cardsLeft = this.deck.cards.length;
	return stats
}
Session.prototype.getStatsFor = function(pid) {
	var stats = this.players[pid].stats;
	stats.cardsLeft = this.deck.cards.length;
	return stats
}
Session.prototype.drawCards = function(cidsToDelete, count) {
	var that = this;
	count = count || 3;
	if(cidsToDelete) {
		cidsToDelete.forEach(function(cid) { delete that.board[cid]; });
	}
	var newCards = [];
	for(var i = 0; i < count && that.deck.cards.length > 0; i++) {
		var c = that.deck.cards.pop();
		that.board[c.cid] = c;
		newCards.push(c);
	}
	return newCards;
}
Session.prototype.turnFor = function(pid) {
	if(this.status !== 'active') {
		throw new Error('session already blocked');
	}
	this.activePlayer = pid;
	this.status = 'blocked';
	console.log('Turn: ' + pid);
}
Session.prototype.turnEnd = function (reason) {
	this.status = 'active';
	clearTimeout(this.timeout);
	stats = this.updateScoreForActivePlayer(reason);
	console.log('Turn end: ' + this.activePlayer + ' (' + reason + ')');
	this.activePlayer = null;
	return stats
}

//--------

var sessions = {};

// Clean up sessions inactive for SESSION_TTL_MS
setInterval(function() {
	var now = Date.now();
	Object.keys(sessions).forEach(function(sid) {
		if(now - sessions[sid].lastActivity > SESSION_TTL_MS) {
			console.log('Cleaning up inactive session:', sid);
			delete sessions[sid];
		}
	});
}, 15 * 60 * 1000); // check every 15 minutes

io.on('connection', function(socket){
	console.log('Client connected: ' + socket.id);

	var player = new Player(socket);

	socket.emit('welcome', JSON.stringify({
		pid: player.pid	
	}));

	socket.on('join', function (json) {
		var session
		,	data = JSON.parse(json);
		if(data.sid === '') {
			session = new Session();
			sessions[session.sid] = session;
			console.log('Create new session for', socket.id);
		} else if(data.sid.charAt(0) !== '#' || !sessions[data.sid]) {
			socket.emit('invalid_session');
			console.log(data.sid)
			return;
		} else {
			session = sessions[data.sid];
		}
		
		session.lastActivity = Date.now();
		session.addPlayer(socket);
		socket.join(session.sid);
		console.log(socket.id, 'joined', session.sid);
		socket.emit('joined', JSON.stringify({
			sid: session.sid,
			board: Object.keys(session.board).map(function(key){return session.board[key]}),
			stats: { cardsLeft: session.deck.cards.length }
		}));

	});

	socket.on('solution_block', function (json) {
		var msg, session
		,	data = JSON.parse(json);
		try {
			session = sessions[data.sid];
			var solo = session.getNumberOfPlayers() <= 1;
			session.turnFor(socket.id);
			if(!solo) {
				// Multiplayer: enforce turn timeout
				session.timeout = setTimeout(function () {
					var stats = session.turnEnd('countdown');
					socket.emit('solution_response',JSON.stringify({
						correct: false,
						error: 'time_out',
						stats: stats
					}));
				}, session.turnTimeout);
			}
			// Solo: no timeout — grant an extended window (30s) just to auto-release
			else {
				session.timeout = setTimeout(function () {
					session.turnEnd('countdown');
				}, 30000);
			}
			msg = { success: true, countdown: solo ? 30000 : session.turnTimeout };
		} catch(e) {
			msg = { success: false };
			console.log(e);
		}
		socket.emit('solution_block_response', JSON.stringify(msg));
		// Broadcast turn start so all players can show who has the turn + countdown
		if(msg.success) {
			var playerIds = Object.keys(session.players);
			var playerNum = playerIds.indexOf(socket.id) + 1;
			socket.broadcast.emit('turn_started', JSON.stringify({
				playerNum: playerNum,
				countdown: msg.countdown
			}));
		}
	});

	socket.on('more_cards', function(json) {
		var msg
		,	data = JSON.parse(json)
		console.log('More cards requested by', socket.id);
		try{
			var session = sessions[data.sid];
			msg = {
				success: true,
				newCards: session.drawCards(),
				stats: { cardsLeft: session.deck.cards.length }
			};
		} catch(e) {
			msg = { success: false };
			console.log(e)
		}
		socket.emit('more_cards_response', JSON.stringify(msg));
	})

	socket.on('solution_query', function (data) {
		console.log('Got solution:');
		var data = JSON.parse(data)
		,	solutionCids = data.cids
		,	session = sessions[data.sid];
		console.log(solutionCids);
		if(session.status !== 'blocked' || session.activePlayer !== socket.id) {
			socket.emit('solution_response',JSON.stringify({
				correct: false,
				error: 'not_your_turn'
			}));
		}
		else if(session.isSolution(solutionCids)) {
			var newCards = session.drawCards(solutionCids);
			stats = session.turnEnd('good solution');
			//needs a check if this has worked!

			// Auto-deal if no valid set remains on board
			var boardCards = Object.keys(session.board).map(function(k){ return session.board[k]; });
			var autoDeal = null;
			if(boardCards.length > 0 && !boardHasValidSet(boardCards) && session.deck.cards.length > 0) {
				autoDeal = session.drawCards(null, 4);
			}
			socket.emit('solution_response',JSON.stringify({
				correct: true,
				oldCardsCids: solutionCids,
				newCards: newCards,
				autoDeal: autoDeal,
				stats: stats
			}));

			socket.broadcast.emit('solution_found', JSON.stringify({
				oldCardsCids: solutionCids,
				newCards: newCards,
				autoDeal: autoDeal,
				stats: { cardsLeft: session.deck.cards.length }
			}));
		}
		else {
			stats = session.turnEnd('bad solution');
			socket.emit('solution_response',JSON.stringify({
				correct: false,
				error: 'just_wrong',
				stats: stats
			}));
			// Notify other players to cancel their countdown
			socket.broadcast.emit('turn_ended', JSON.stringify({ reason: 'wrong' }));
		}
	});

	socket.on('finished', function (json) {
		var data = JSON.parse(json);
		socket.emit('finished_response', JSON.stringify({
			stats: sessions[data.sid].getStatsFor(socket.id)
		}));
	});

	socket.on('leave', function (json) {
		var data = JSON.parse(json);
		try {
			if(sessions[data.sid].getNumberOfPlayers() === 1) {
				delete sessions[data.sid];
			}
		} catch(e) { console.log(e)}
	})

	socket.on('disconnect', function () {
		console.log('Client disconnected: ' + socket.id);
	})
});

function sendFail(res) {}