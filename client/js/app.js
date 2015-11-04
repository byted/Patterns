$(function () {
	var welcomeBack = localStorage.getItem('welcomeBack')
	,	socket = io()
	,	board = {}
	,	ourTurn = false
	,	timer = null;

	socket.on('welcome', function (json) {
		socket.emit('join', JSON.stringify({
			sid: location.hash
		}));
	});

	socket.on('invalid_session', function () {
		showSplashScreen('Game not found.');
	});

	socket.on('joined', function (json) {
		try {
			var data = JSON.parse(json);
			location.hash = data.sid;
			$('#stats').fadeIn();
			renderBoardUpdate(null, data.board);
			renderStatsUpdate(data.stats);
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
				renderStatsUpdate(data.stats);
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
				console.log(data)
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

	socket.on('finished_response', function (json) {
		var data = JSON.parse(json)
		,	highscore = localStorage.getItem('highscore')
		, 	spruch = 'Nah, not your best game. Maybe you\'re drunk?';
		if(!highscore || highscore < data.stats.points) {
			localStorage.setItem('highscore', data.stats.points);
			spruch = !highscore ? 'Welcome! Keep playing to get better.' : 'Wow, you topped yourself. Have a cookie!';
		}
		var content = '<div class="gameOver">'+spruch+'</div><span class="goodAttempts">'+ data.stats.goodAttempts + 
				' patterns</span> + <span class="badAttempts">' + data.stats.badAttempts + 
				' bad attempts</span><div class="points">= ' + data.stats.points + ' Points</div>'
		showSplashScreen(content);
	});

	function showSplashScreen(content) {
		$('#board').css('transform', 'rotateY(270deg)');
		$('#stats').slideUp();
		$('#splashScreen > div').html(content);
		var sc = $('#splashScreen');
		sc.css('margin-top', $('body').height());
		sc.show();
		sc.animate({marginTop: 50});
	}

	function buildCard(card, withoutContainer) {
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
		return withoutContainer ? cardContentEl : cardContainerEl.append(cardContentEl);
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
						.empty()
						.append(buildCard(newCards[i], true));
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
		if(stats.points) { $('#points > span').html(stats.points); }
		if(stats.goodAttempts) { $('#goodAttempts > span').html(stats.goodAttempts); }
		if(stats.badAttempts) { $('#badAttempts > span').html(stats.badAttempts); }
		if(stats.cardsLeft) { $('#cardsLeft > span').html(stats.cardsLeft); }
		if(stats.cardsLeft === 0) {
			$('#moreCards')
				.removeClass('blendOut').addClass('blendIn')
				.html('I\'m done')
				.off()
				.click(function() { socket.emit('finished', JSON.stringify({sid: location.hash})); });
		}
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