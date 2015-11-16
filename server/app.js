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
function Session() {
	this.sid = '#' + guidGenerator('sid_');
	this.status = 'active';
	this.activePlayer;
	this.deck = new Deck()
	this.board = {};
	this.players = {};
	this.turnTimeout = 3000;
	this.timeout = null;

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
Session.prototype.drawCards = function(cidsToDelete) {
	var boardSize;
	var that = this;
	if(cidsToDelete) {
		cidsToDelete.forEach(function(cid) {
			delete that.board[cid];
		});
	}
	boardSize = Object.keys(this.board).length;
	if(boardSize === 9 || (boardSize === 12 && !cidsToDelete)) {
		var cards = this.deck.draw(3)
		,	that = this;
		cards.forEach(function(c) {
			that.board[c.cid] = c;
		});
		return cards;
	} else if(boardSize > 12) {
		throw new Error('Board is already full');
	}
	return []
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
			session.turnFor(socket.id);
			session.timeout = setTimeout(function () {
				var stats = session.turnEnd('countdown');
				socket.emit('solution_response',JSON.stringify({
					correct: false,
					error: 'time_out',
					stats: stats
				}));
			}, session.turnTimeout);
			msg = { success: true, countdown: session.turnTimeout };
		} catch(e) {
			msg = { success: false };
			console.log(e);
		}
		socket.emit('solution_block_response', JSON.stringify(msg));
		// for now, don't inform other players about the block
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

			socket.emit('solution_response',JSON.stringify({
				correct: true,
				oldCardsCids: solutionCids,
				newCards: newCards,
				stats: stats
			}));

			socket.broadcast.emit('solution_found', JSON.stringify({
				oldCardsCids: solutionCids,
				newCards: newCards,
			}));
		}
		else {
			stats = session.turnEnd('bad solution');
			socket.emit('solution_response',JSON.stringify({
				correct: false,
				error: 'just_wrong',
				stats: stats
			}));
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