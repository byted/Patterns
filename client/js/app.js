$(function () {
	var welcomeBack = localStorage.getItem('welcomeBack')
	,	socket = io()
	,	pid
	,	board = {}
	,	ourTurn = false
	,	timer = null;

	socket.on('welcome', function (json) {
		pid = JSON.parse(json).pid;
		socket.emit('join', JSON.stringify({
			sid: location.hash
		}));
	});

	socket.on('invalid_session', function () {
		$('#board').html('<div id="invalidSession" class="centercenter">Invalid session.</br><a href="/">⟳ Start a new one</a></div>');
	})

	socket.on('joined', function (json) {
		try {
			var data = JSON.parse(json);
			location.hash = data.sid;
			$('#stats').fadeIn();
			renderBoardUpdate(null, data.board);
			if(!welcomeBack) {
				$('body').chardinJs('start');
				localStorage.setItem('welcomeBack', 'hell yeah')
			}
		} catch(e) {console.log(e); }
	});

	socket.on('solution_block_response', function (json) {
		try{
			var data = JSON.parse(json);
			if(data.success) { 
				startTurn(data.countdown);
			} else {
				endTurn('alreadyBlocked');
			}
		} catch(e) {}
	});

	socket.on('more_cards_response', function (json) {
		try{
			var data = JSON.parse(json);
			if(data.success) { 
				data.newCards.forEach(function (card) {
					board[card.cid] = card;
				});
				renderBoardUpdate(null, data.newCards);
			} else {
				console.log('Board already full!');
			}
		} catch(e) {}
	});

	socket.on('solution_response', function (json) {
		try {
			var data = JSON.parse(json);
			if(data.correct) {
				reason = 'good solution';
				//handle correct solution
				data.oldCardsCids.forEach(function (cid) {
					delete board[cid];
				});
				data.newCards.forEach(function (card) {
					board[card.cid] = card;
				});
				renderBoardUpdate(data.oldCardsCids, data.newCards);

			} else {
				reason = 'bad solution';
				console.log(data.error);
				// do some more UI stuff to give the user some feedback
			}
			renderStatsUpdate(data.stats);
			endTurn(reason);
		} catch(e) {console.log(e); }
	});

	socket.on('solution_found', function (json) {
		try { 
			var data = JSON.parse(json);
			//handle correct solution
			data.oldCardsCids.forEach(function (cid) {
				delete board[cid];
			});
			data.newCards.forEach(function (card) {
				board[card.cid] = card;
			});
			renderBoardUpdate(data.oldCardsCids, data.newCards);
			$('.card.selected').removeClass('selected');
		} catch(e) {console.log(e); }
	});

	function buildCard(card) {
		var cardContainerEl = $('<div class="card blendOut" id="' + card.cid + '"></div>'),
			cardContentEl = $('<div class="content"></div>');
		
		cardContainerEl.click(function (e) {
				if(!ourTurn) { askForTurn() }
				$(this).toggleClass('selected');
				checkAndSendSolution('.selected');
			});

		for (var i = card.count - 1; i >= 0; i--) {
			cardContentEl.append(buildSymbol(card));
		};
		return cardContainerEl.append(cardContentEl);
	}

	function buildSymbol(card) {
		return '<div class="symbol '+ card.color +' '+ card.shape +' '+ card.fill +'"><div class="content"></div></div>';
	}

	function renderBoardUpdate(oldCardsCids, newCards) {
		if(!oldCardsCids) {
			//only add new ones
			boardEl = $('#board');
			newCards.forEach(function(card) {
				board[card.cid] = card;
				boardEl.append(buildCard(card));
			});
			if(Object.keys(newCards).length == 3) {
				makeBoard('bigger');
				$('#moreCards').removeClass('blendIn').addClass('blendOut');
			} else {
				makeBoard('smaller');
				$('#moreCards').removeClass('blendOut').addClass('blendIn');
			}
			$('.card').addClass('blendIn');
		} else if(newCards.length === 0) {
			//only remove old ones
			$('#moreCards').removeClass('blendOut').addClass('blendIn');
			oldCardsCids.forEach(function (cid, i) {
				var el = $('#' + cid);
				el.removeClass('blendIn')
					.addClass('blendOut');
				setTimeout(function () {
					el.remove();
				}, 250);
			});
			makeBoard('smaller');
		} else if(oldCardsCids.length === newCards.length) {
			//update inplace
			oldCardsCids.forEach(function (cid, i) {
				var el = $('#' + cid);
				el.removeClass('blendIn')
					.addClass('blendOut');
				setTimeout(function () {
					el.attr('id', newCards[i].cid)
						.children('.content')
						.empty()
						.append(buildSymbol(newCards[i]));
					el.addClass('blendIn');
				}, 250);
					
			});
		}
	}

	function makeBoard(newSize) {
		if(newSize === 'smaller') {
			var widthOfBoard = $('#board').width()
			,	widthOfCards = $('.card').outerWidth(true) * 4
			,	toTranslate = (widthOfBoard - widthOfCards) / 2
			$('#board').css('transform', 'translateX(' + toTranslate + 'px)');
		} else if (newSize === 'bigger') {
			$('#board').css('transform', 'translateX(0)');
		}
	}

	function renderStatsUpdate(stats) {
		$('#points > span').html(stats.points);
		$('#goodAttempts > span').html(stats.goodAttempts);
		$('#badAttempts > span').html(stats.badAttempts);
	}

	function startTurn(milisecondsToGo) {
		ourTurn = true
		// set timer
		var countEl = $('#countdown')
		timer = setInterval(function(){
			var oldValue = parseFloat(countEl.html());
			if(oldValue > 0.1) {
				countEl.html((oldValue - 0.1).toFixed(1));
			} else {
				endTurn('countdown');
			}
		}, 100);
		countEl.html(milisecondsToGo / 1000);
		countEl.removeClass('invisvible');
	}

	function endTurn(reason) {
		console.log('End of turn: ' + reason)
		clearInterval(timer);
		$('#countdown').addClass('invisvible');
		ourTurn = false;
		$('.card.selected').removeClass('selected');
	}

	function checkAndSendSolution(selector) {
		var selected = $(selector);
		if(selected.length === 3) {
			if(ourTurn) {
				sendSolution([selected[0].id, selected[1].id, selected[2].id]);
			} else { console.log('Can not send. It is not our turn!'); }
		}
	}

	function sendSolution(cids) {
		try {
			socket.emit('solution_query', JSON.stringify({
				cids: cids,
				sid: location.hash
			}));
		} catch(e) { console.log('Couldn\'t send solution'); }
	}

	function askForTurn() {
		try {
			socket.emit('solution_block', JSON.stringify({sid: location.hash}));
		} catch(e) { console.log('Couldn\'t send request for solution block'); }
	}

	$('#moreCards').click(function() {
		try {
			socket.emit('more_cards', JSON.stringify({sid: location.hash}));
		} catch(e) { console.log(s); }
	});
	$(window).unload(function() {
		socket.emit('leave', JSON.stringify({sid: location.hash}))
	})
});