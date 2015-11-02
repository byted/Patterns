var serveStatic = require('serve-static');
var app = require('connect')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(serveStatic(__dirname + '/../client'));
http.listen(process.env.PORT || 3000);

// game logic
var COLORS = ['red', 'blue', 'green'];
var SHAPES = ['square', 'circle', 'triangle'];
var FILLS = ['none', 'lines', 'full'];

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
//Session
function Session() {
	this.sid = '#' + guidGenerator('sid_');
	this.status = 'active';
	this.activePlayer;
	this.board = createBoard();
	this.players = {};
	this.turnTimeout = 3000;
	this.timeout = null;

	function createBoard() {
		var c = {};
		for(var i = 0; i < 12; i++) {
			var newCard = new Card(getRandomProperties());
			c[newCard.cid] = newCard;
		}
		return c;
	}

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
		var card1 = new Card(getRandomProperties());
		var card2 = new Card(getRandomProperties());
		var card3 = new Card(getRandomProperties());
		this.board[card1.cid] = card1;
		this.board[card2.cid] = card2;
		this.board[card3.cid] = card3;
		return [card1, card2, card3];
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
			board: Object.keys(session.board).map(function(key){return session.board[key]})
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
			msg = { success: true, newCards: sessions[data.sid].drawCards() };
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
			stats = session.turnEnd('good solution');
			var newCards = session.drawCards(solutionCids);
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