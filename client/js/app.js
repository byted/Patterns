$(function () {
    'use strict'
    /* global io */
    /*eslint no-console: 0*/    
    var welcomeBack = localStorage.getItem('welcomeBack_' + location.hostname)
    ,   socket = io()
    ,   board = {}
    ,   ourTurn = false
    ,   timer = null
    ,   pendingSelection = null

    socket.on('welcome', function() {
        socket.emit('join', JSON.stringify({
            sid: location.hash
        }))
    })

    socket.on('invalid_session', function () {
        showSplashScreen('Game not found.')
    })

    socket.on('joined', function(json) {
        try {
            var data = JSON.parse(json)
            location.hash = data.sid
            setTimeout(function () {
                $('#stats').css('opacity', '1')
            }, 300)
            renderBoardUpdate(null, data.board)
            renderStatsUpdate(data.stats)
            renderPlayerStats(data.allPlayerStats)
            if(!welcomeBack) {
                showTutorial()
                localStorage.setItem('welcomeBack_' + location.hostname, 'hell yeah')
            }
        } catch(e) { console.log(e); throw e}
    })

    socket.on('solution_block_response', function(json) {
        try{
            var data = JSON.parse(json)
            if(data.success) { 
                startTurn(data.countdown)
                // Send buffered selection if player had already picked 3 cards
                if(pendingSelection) {
                    sendSolution(pendingSelection)
                    pendingSelection = null
                }
            } else {
                endTurn('alreadyBlocked')
            }
        } catch(e) {console.log(e)}
    })

    socket.on('more_cards_response', function (json) {
        try{
            var data = JSON.parse(json)
            if(data.success) { 
                data.newCards.forEach(function (card) {
                    board[card.cid] = card
                })
                    renderBoardUpdate(null, data.newCards)
                renderStatsUpdate(data.stats)
            } else {
                console.log('Board already full!')
            }
        } catch(e) {console.log(e)}
    })

    socket.on('solution_response', function (json) {
        try {
            var data = JSON.parse(json)
            if(data.correct) {
                renderPlayerStats(data.allPlayerStats)
                var reason = 'good solution'
                //handle correct solution
                console.log(data)
                data.oldCardsCids.forEach(function (cid) {
                    delete board[cid]
                })
                data.newCards.forEach(function (card) {
                    board[card.cid] = card
                })
                renderBoardUpdate(data.oldCardsCids, data.newCards)
                // Auto-deal: server detected no valid set and dealt 3 more cards
                if(data.autoDeal && data.autoDeal.length > 0) {
                    data.autoDeal.forEach(function (card) { board[card.cid] = card })
                    setTimeout(function() {
                        renderBoardUpdate(null, data.autoDeal)
                    }, 600)
                    showNoSetMessage()
                }
            } else {
                reason = 'bad solution'
                console.log(data.error)
                // Flash red + shake on wrong answer
                var wrongCards = $('.content.selected')
                wrongCards.addClass('wrong')
                setTimeout(function() { wrongCards.removeClass('wrong') }, 500)
            }
            renderStatsUpdate(data.stats)
            endTurn(reason)
        } catch(e) {console.log(e) }
    })

    socket.on('turn_started', function(json) {
        try {
            var data = JSON.parse(json)
            showTurnToast('Player ' + data.playerNum + '’s turn', data.countdown)
            // Mirror countdown for observers
            _turnToastInterval = setInterval(function(){
                var remaining = parseFloat($('#turnToastTimer').text())
                if(remaining > 0.1) {
                    $('#turnToastTimer').text((remaining - 0.1).toFixed(1))
                } else {
                    clearInterval(_turnToastInterval); _turnToastInterval = null
                    dismissTurnToast()
                }
            }, 100)
        } catch(e) { console.log(e) }
    })

    socket.on('turn_ended', function() {
        dismissTurnToast()
    })

    socket.on('solution_found', function (json) {
        try { 
            var data = JSON.parse(json)
            dismissTurnToast()
            //handle correct solution
            data.oldCardsCids.forEach(function (cid) {
                delete board[cid]
            })
            data.newCards.forEach(function (card) {
                board[card.cid] = card
            })
            renderBoardUpdate(data.oldCardsCids, data.newCards)
            $('.card.selected').removeClass('selected')
            renderPlayerStats(data.allPlayerStats)
            if(data.stats && data.stats.cardsLeft !== undefined) {
                $('#cardsLeft').html(data.stats.cardsLeft)
            }
        } catch(e) {console.log(e) }
    })

    socket.on('finished_response', function (json) {
        var data = JSON.parse(json)
        ,   highscore = localStorage.getItem('highscore')
        ,   spruch = 'Nah, not your best game. Maybe you\'re drunk?'
        if(!highscore || highscore < data.stats.points) {
            localStorage.setItem('highscore', data.stats.points)
            spruch = !highscore ? 'Welcome! Keep playing to get better.' : 'Wow, you topped yourself. Have a cookie!'
        }
        var content = `<div class="gameOver">${spruch}</div>
            <span class="goodAttempts">${data.stats.goodAttempts} patterns</span> + 
            <span class="badAttempts">${data.stats.badAttempts} bad attempts</span>=
            <div class="points">${data.stats.points} Points</div>`
        showSplashScreen(content)
    })

    function showTutorial() {
        var overlay = $('<div id="tutorialOverlay"></div>')
        var box = $('<div id="tutorialBox"></div>')
        box.html(
            '<button id="tutorialClose" aria-label="Close">&times;</button>' +
            '<h2>How to play</h2>' +
            '<p>Find <strong>triplets</strong> where each property is <strong>all the same</strong> or <strong>all different</strong>:</p>' +
            '<ul>' +
            '<li><strong>Color</strong> — red, blue, green</li>' +
            '<li><strong>Shape</strong> — circle, square, triangle</li>' +
            '<li><strong>Fill</strong> — empty, striped, solid</li>' +
            '<li><strong>Count</strong> — 1, 2, 3</li>' +
            '</ul>' +
            '<p>Click any card to claim your turn, then select 2 more.</p>' +
            '<p>✓ +1 pt &nbsp; ✗ −3 pts (wrong or timeout)</p>' +
            '<button id="tutorialDismiss">Got it</button>'
        )
        overlay.append(box)
        $('body').append(overlay)
        $('#tutorialDismiss, #tutorialClose').click(function() { overlay.remove() })
        overlay.click(function(e) { if(e.target === overlay[0]) overlay.remove() })
    }

    function showNoSetMessage() {
        var msg = $('<div id="noSetToast">No valid set — 3 more cards dealt</div>')
        $('body').append(msg)
        setTimeout(function() { msg.fadeOut(400, function() { msg.remove() }) }, 2500)
    }

    function showToast(msg) {
        var el = $('<div class="gameToast"></div>').text(msg)
        $('body').append(el)
        setTimeout(function() { el.fadeOut(400, function() { el.remove() }) }, 2500)
    }

    $('#shareGame').click(function() {
        var url = location.href
        if(navigator.clipboard) {
            navigator.clipboard.writeText(url).then(function() {
                showToast('Link copied!')
            }).catch(function() {
                prompt('Share this link:', url)
            })
        } else {
            prompt('Share this link:', url)
        }
    })
    function renderPlayerStats(allStats) {
        if(!allStats || allStats.length <= 1) { $('#playerStats').hide(); return; }
        var html = allStats.map(function(p) {
            return '<span class="pstat">P' + p.playerNum + ': <strong>' + p.points + '</strong>pt (' + p.goodAttempts + '✓ ' + p.badAttempts + '✗)</span>';
        }).join('');
        $('#playerStats').html(html).show();
    }

    var _turnToastEl = null
    var _turnToastInterval = null

    function showTurnToast(label, ms) {
        dismissTurnToast()
        var secs = (ms / 1000).toFixed(1)
        _turnToastEl = $('<div id="turnToast"><span id="turnToastLabel"></span> <span id="turnToastTimer"></span>s</div>')
        $('#turnToastLabel').length || true // label set below
        _turnToastEl.find('#turnToastLabel').text(label)
        _turnToastEl.find('#turnToastTimer').text(secs)
        $('body').append(_turnToastEl)
    }

    function dismissTurnToast() {
        if(_turnToastInterval) { clearInterval(_turnToastInterval); _turnToastInterval = null }
        if(_turnToastEl) { _turnToastEl.remove(); _turnToastEl = null }
    }

    // ── Dev debug helpers ──────────────────────────────
    function clientIsValidSet(a, b, c) {
        var props = ['color', 'shape', 'fill', 'count'];
        return props.every(function(p) {
            var allSame = a[p] === b[p] && b[p] === c[p];
            var allDiff = a[p] !== b[p] && b[p] !== c[p] && a[p] !== c[p];
            return allSame || allDiff;
        });
    }
    window.debugPatterns = {
        checkSets: function() {
            var cards = Object.keys(board).map(function(k){ return board[k] });
            var found = [];
            for(var i = 0; i < cards.length - 2; i++) {
                for(var j = i+1; j < cards.length - 1; j++) {
                    for(var k = j+1; k < cards.length; k++) {
                        if(clientIsValidSet(cards[i], cards[j], cards[k])) {
                            found.push([cards[i].cid, cards[j].cid, cards[k].cid]);
                        }
                    }
                }
            }
            console.log('Board cards:', cards.length, '| Valid sets found:', found.length);
            found.forEach(function(s, i) { console.log('  Set ' + (i+1) + ':', s.join(', ')) });
            if(found.length === 0) console.warn('No valid sets! Auto-deal should trigger on next correct solution.');
            return found;
        },
        board: function() { return board; }
    };
    console.log('[debug] debugPatterns.checkSets() — check valid sets on board');
    console.log('[debug] debugPatterns.checkSets() to check for valid sets');
    // ─────────────────────────────────────────────────────

    function showSplashScreen(content) {
        $('#stats, #board').slideUp(function () {
            $('#splashScreen > div').html(content)
            $('#splashScreen').fadeIn()  
        })
    }

    function buildCard(card) {
        var cardContentEl = $(`<div id="${card.cid}" class="content"></div>`)
        cardContentEl.click(function () {
            if(!ourTurn) { askForTurn() }
            $(this).toggleClass('selected')
            checkAndSendSolution('.selected')
        })

        for (var i = card.count; i > 0; i--) {
            cardContentEl.prepend(buildSymbol(card, true))
        }
        return cardContentEl
    }

    function buildSymbol(card) {
        return `<svg viewBox="0 0 100 100">
            <${card.shape} ${card.shape === 'polygon' ? 'points="5,95  95,95  50,5"' : ''} class="symbol ${card.color} ${card.fill}"></${card.shape}>
        </svg>`
    }

    function renderBoardUpdate(oldCardsCids, newCards) {
        function add(newCards) {
            var cardContainer = $('.card').filter(function() {
                return !$(this).children().length
            })
            for(var i = 0; i < newCards.length; i++) {
                board[newCards[i].cid] = newCards[i]
                $(cardContainer[i]).append(buildCard(newCards[i]))
            }
            $('.card > .content').addClass('blendIn')
        }
        function remove(cids, cb) {
            var selector = [''].concat(cids).join(',#')
            $(selector).removeClass('blendIn').addClass('blendOut')
            setTimeout(function () {
                $(selector).remove()
                cb()
            }, 250)
        }
        if(!oldCardsCids) {
            add(newCards)
        } else if(newCards.length === 0) {
            remove(oldCardsCids)		
        } else if(oldCardsCids.length === newCards.length) {
            remove(oldCardsCids, function() { add(newCards) })
        }
    }

    function renderStatsUpdate(stats) {
        if(stats.points) { $('#points').html(stats.points) }
        if(stats.goodAttempts) { $('#goodAttempts').html(stats.goodAttempts) }
        if(stats.badAttempts) { $('#badAttempts').html(stats.badAttempts) }
        if(stats.cardsLeft) { $('#cardsLeft').html(stats.cardsLeft) }
        if(stats.cardsLeft === 0) {
            socket.emit('finished', JSON.stringify({sid: location.hash}))
        }
    }

    function startTurn(millisecondsToGo) {
        ourTurn = true
        showTurnToast('Your turn!', millisecondsToGo)
        timer = setInterval(function(){
            var remaining = parseFloat($('#turnToastTimer').text())
            if(remaining > 0.1) {
                $('#turnToastTimer').text((remaining - 0.1).toFixed(1))
            } else {
                endTurn('countdown')
            }
        }, 100)
    }

    function endTurn(reason) {
        console.log('End of turn: ' + reason)
        clearInterval(timer)
        dismissTurnToast()
        ourTurn = false
        pendingSelection = null
        setTimeout(function () {
            $('.content.selected').removeClass('selected')
        }, 500)
    }

    function checkAndSendSolution(selector) {
        var selected = $(selector)
        if(selected.length === 3) {
            if(ourTurn) {
                setTimeout(function () {
                    sendSolution([selected[0].id, selected[1].id, selected[2].id])
                }, 200)
            } else {
                // Buffer the selection — will be sent once turn is granted
                pendingSelection = [selected[0].id, selected[1].id, selected[2].id]
            }
        }
    }

    function sendSolution(cids) {
        try {
            socket.emit('solution_query', JSON.stringify({
                cids: cids,
                sid: location.hash
            }))
        } catch(e) { console.log('Couldn\'t send solution') }
    }

    function askForTurn() {
        try {
            socket.emit('solution_block', JSON.stringify({sid: location.hash}))
        } catch(e) { console.log('Couldn\'t send request for solution block') }
    }

    $(window).on('beforeunload', function() {
        socket.emit('leave', JSON.stringify({sid: location.hash}))
    })
})