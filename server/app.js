var serveStatic = require('serve-static');
var app = require('connect')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(serveStatic(__dirname + '/../client'));
http.listen(3000);

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
	this.points = 0;
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
	this.sid = guidGenerator('sid_');
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
Session.prototype.pointsForActivePlayer = function(pointsDelta) {
	if(pointsDelta) {
		this.players[this.activePlayer].points += pointsDelta
	}
	return this.players[this.activePlayer].points
}
Session.prototype.replaceCardsWithRandom = function(cids) {
	//delete cards from solution
	delete this.board[cids[0]];
	delete this.board[cids[1]];
	delete this.board[cids[2]];
	// draw new cards
	var card1 = new Card(getRandomProperties());
	var card2 = new Card(getRandomProperties());
	var card3 = new Card(getRandomProperties());
	this.board[card1.cid] = card1;
	this.board[card2.cid] = card2;
	this.board[card3.cid] = card3;

	return [card1, card2, card3];
}
Session.prototype.turnFor = function (pid) {
	if(this.status !== 'active') {
		throw new Error('session already blocked');
	}
	this.activePlayer = pid;
	this.status = 'blocked';
	console.log('Turn: ' + pid);
	var that = this;
	this.timeout = setTimeout(function () {
		that.turnEnd('countdown', 0);
	}, this.turnTimeout);

}
Session.prototype.turnEnd = function (reason, pointsDelta) {
	this.status = 'active';
	clearTimeout(this.timeout);
	console.log('Turn end: ' + this.activePlayer + ' (' + reason + ')');
	points = this.pointsForActivePlayer(pointsDelta);
	this.activePlayer = null;
	return points
}

//--------

var sessions = {};
var session;

io.on('connection', function(socket){
	console.log('Client connected: ' + socket.id);
	if(!session) {
		session = new Session();
	}
	socket.join(session.sid);
	session.addPlayer(socket);

	socket.emit('joined', JSON.stringify({
		board: session.board,
		status: session.status	
	}));

	socket.on('solution_block', function () {
		var msg;
		try {
			session.turnFor(socket.id);
			msg = { success: true, countdown: session.turnTimeout };
		} catch(e) {
			msg = { success: false };
			console.log(e);
		}
		socket.emit('solution_block_response', JSON.stringify(msg));
		// for now, don't inform other players about the block
	});

	socket.on('solution_query', function (data) {
		console.log('Got solution:');
		var solution = JSON.parse(data);
		console.log(solution);
		var solutionCids = solution.cids;
		if(session.status !== 'blocked' || session.activePlayer !== socket.id) {
			socket.emit('solution_response',JSON.stringify({
				correct: false,
				error: 'not_your_turn'
			}));
		}
		else if(session.isSolution(solutionCids)) {
			points = session.turnEnd('SolutionCorrect', 1);
			var newCards = session.replaceCardsWithRandom(solutionCids);
			//needs a check if this has worked!

			socket.emit('solution_response',JSON.stringify({
				correct: true,
				oldCardsCids: solutionCids,
				newCards: newCards,
				points: points
			}));

			socket.broadcast.emit('solution_found', JSON.stringify({
				oldCardsCids: solutionCids,
				newCards: newCards,
			}));
		}
		else {
			points = session.turnEnd('SolutionWrong', -3);
			socket.emit('solution_response',JSON.stringify({
				correct: false,
				error: 'just_wrong',
				points: points
			}));
		}
	});

	socket.on('disconnect', function () {
		console.log('Client disconnected: ' + socket.id);
	})
});

function sendFail(res) {}