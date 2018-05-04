"use strict";

function colorWalk() {
  var _block_inspect_counter = 0;
  var _block_filter_counter = 0;
  var blocks = [];
  var clusters = [];
  var markers = [];
  var colors = ['#14b19f', '#0e274e', '#ec5257', '#6c2275', '#f9ac00'];
  var controls = [];
  var grid_length = 30;
  var grid_height = 20;
  var block_size = 20;
  var moves = 0;
  var game_moves = [];
  var seed = 1;

  makeBlocks();

  _.each(colors, function (color, i) {
    controls.push(new Control(color, i));
  });

  new Solver();

  $('.close').on('click', function () {
    $('.modal').fadeOut(300);
  });

  function Block(x, y, color, i, isDead) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.position = i;
    this.isDead = isDead;
    this.cluster = null;
    var that = this;

    $('<div>', {
      id: 'block' + this.position,
      class: "block",
      style: "left:" + this.x + "px; top: " + this.y + 'px; background-color:' + this.color
    }).on('click', function (e) {
      if (that.cluster != null) {
        var x = that.position % grid_length;
        var y = Math.floor(that.position / grid_length);
        var positions = _.map(that.cluster.blocks, function(block) {
          return block.position;
        });
        var neighbors = _.map(that.cluster.neighbors, function(neighbor) {
          return neighbor.blocks[0].position;
        });
        console.log("[" + x + "," + y + "] blocks: " + positions.toString());
        console.log("[" + x + "," + y + "] neighbors: " + neighbors.toString());
      }
    }).appendTo('#gameboard');

    this.getNeighbors = function() {
      var neighbors = [];
      var i = this.position;
      if (i % grid_length > 0) {
        neighbors.push(i - 1);
      }
      if (i % grid_length + 1 < grid_length) {
        neighbors.push(i + 1);
      }
      if (i - grid_length > 0) {
        neighbors.push(i - grid_length);
      }
      if (i + grid_length + 1 < grid_length * grid_height) {
        neighbors.push(i + grid_length);
      }

      return neighbors;
    };
  }

  function Cluster(block) {
    this.blocks = [block];
    this.neighbors = [];
    block.cluster = this;
    var that = this;

    function selectClusterBlocks(neighbors) {
      return _.filter(neighbors, function(pos) {
        return blocks[pos].cluster == null && blocks[pos].color === block.color;
      });
    };

    function findClusterNeighbors(block) {
      var cluster_neighbors = block.getNeighbors();
      var cluster_blocks = selectClusterBlocks(cluster_neighbors);
      cluster_neighbors = _.difference(cluster_neighbors, cluster_blocks);

      while (cluster_blocks.length > 0) {
        cluster_blocks = _.flatten(_.map(cluster_blocks, function(pos) {
          that.blocks.push(blocks[pos]);
          blocks[pos].cluster = that;
          cluster_neighbors = _.union(cluster_neighbors, blocks[pos].getNeighbors());
          return selectClusterBlocks(blocks[pos].getNeighbors());
        }));
        cluster_neighbors = _.difference(cluster_neighbors, cluster_blocks);
      }

      var pos_blocks = _.map(that.blocks, function(b) { return b.position; });
      return _.difference(cluster_neighbors, pos_blocks);
    };

    function createNeighboringClusters(cluster_neighbors) {
      _.each(cluster_neighbors, function(pos) {
        if (blocks[pos].cluster == null) {
          clusters.push(new Cluster(blocks[pos]));
        }
        if (!_.contains(that.neighbors, blocks[pos].cluster)) {
          blocks[pos].cluster.neighbors.push(that);
          that.neighbors.push(blocks[pos].cluster);
        }
      });
    }

    var cluster_neighbors = findClusterNeighbors(block);
    createNeighboringClusters(cluster_neighbors);

    this.markNeighbors = function(color, check_move) {
      _.each(that.neighbors, function (neighbor) {
        var block = neighbor.blocks[0];

        if (markers[that.blocks[0].position] < markers[block.position] && markers[block.position] < check_move) {
          block.cluster.markNeighbors(color, check_move);
        } else if (block.color === color && !block.isDead && markers[block.position] === 0) {
          _.each(neighbor.blocks, function(block) {
            if (check_move > 0) {
              markers[block.position] = check_move;
            } else {
              block.isDead = true;
              $('#block' + block.position).css('background-color', '#d9d9d9');
            }
          });

          if (check_move === 0) {
            that.blocks = _.union(that.blocks, neighbor.blocks);
            that.neighbors = _.union(_.without(that.neighbors, neighbor), _.without(neighbor.neighbors, that));
            _.each(neighbor.neighbors, function (next_neighbor) {
              next_neighbor.neighbors = _.without(next_neighbor.neighbors, neighbor);
            });
          }
        }
      });
    }

    this.clearMarks = function(check_move) {
      _.each(that.neighbors, function (neighbor) {
        _block_filter_counter += 1;
        var block = neighbor.blocks[0];
        if (markers[that.blocks[0].position] < markers[block.position]) {
          block.cluster.clearMarks(check_move);
        }
        if (markers[block.position] >= check_move) {
          _.each(neighbor.blocks, function(block) {
            markers[block.position] = 0;
          });
        }
      });
    }
  }

  function Control(color, index) {
    this.color = color;
    this.index = index;
    var that = this;

    $('<div>', {
      class: "control btn",
      style: "background-color:" + this.color
    }).on('click', function (e) {
      that.updateGameBoard();
    }).appendTo('#control_container');

    this.updateGameBoard = function() {
      this.checkGameBoard(0, nullMetric);

      if (isFinished()) {
        game_moves.push(moves + 1);
        console.log("game moves: " + (moves + 1));
        makeBlocks();
      } else {
        moves += 1;
      }

      //console.log(moves + " live clusters: " + countLiveClusters());
      $('.score').text(moves);
    }

    this.checkGameBoard = function(check_move, metric) {
      _.each(blocks, function (block) {
        if (markers[block.position] >= check_move) {
          markers[block.position] = 0;
        }
      });

      blocks[0].cluster.markNeighbors(this.color, check_move);

      return metric();
    }

    function countLiveClusters() {
      return _.filter(clusters, function (cluster) {
        return !cluster.blocks[0].isDead;
      }).length;
    }

    function isFinished() {
      return _.all(blocks, function (block) {
        return block.isDead;
      });
    }
  }

  function Solver() {
    var that = this;
    var iterations = 0;
    var max_moves = 2;
    var scale_factor = 25;
    var time = 0;
    var start_time = 0;

    this.index = 0;
    this.metric = nullMetric;

    this.solver = $('<div>', {
      id: 'solver',
      class: 'control btn',
      style: 'background-color:' + colors[this.index]
    }).on('click', function (e) {
      max_moves = $('#solver_max_moves').val();
      scale_factor = $('#solver_scale_factor').val();
      that.runAlgorithm();
    }).appendTo('#solver_container');

    $('#solver_type').change(function () {
      switch (this.value) {
        case 'round-robin':
          that.solverType = that.roundRobin;
          break;
        case 'round-robin-skip':
          that.solverType = that.roundRobinWithSkipping;
          break;
        case 'random':
          that.solverType = that.randomChoice;
          break;
        case 'random-skip':
          that.solverType = that.randomChoiceWithSkipping;
          break;
        case 'greedy':
          that.solverType = that.greedy;
          that.metric = areaCount;
          break;
        case 'greedy-look-ahead':
          that.solverType = that.greedyLookAhead;
          that.metric = areaCount;
          break;
        case 'max-perimeter':
          that.solverType = that.greedy;
          that.metric = perimeterCount;
          break;
        case 'max-perimeter-look-ahead':
          that.solverType = that.greedyLookAhead;
          that.metric = perimeterCount;
          break;
        case 'perimeter-area':
          that.solverType = that.greedy;
          that.metric = perimeterAreaHybrid;
          break;
        case 'perimeter-area-look-ahead':
          that.solverType = that.greedyLookAhead;
          that.metric = perimeterAreaHybrid;
          break;
        case 'deep-path':
          that.solverType = that.greedy;
          that.metric = ratioCalc;
          break;
        case 'deep-path-look-ahead':
          that.solverType = that.greedyLookAhead;
          that.metric = ratioCalc;
          break;
        case 'path-area':
          that.solverType = that.greedy;
          that.metric = ratioAreaHybrid;
          break;
        case 'path-area-look-ahead':
          that.solverType = that.greedyLookAhead;
          that.metric = ratioAreaHybrid;
          break;
        case 'bfs':
          that.solverType = that.bfsWithGla;
          that.metric = areaCount;
          break;
        case 'dfs':
          that.solverType = that.dfs;
          that.metric = areaCount;
          break;
        case 'dijkstra':
          that.solverType = that.dijkstra;
          that.metric = areaCount;
          break;
        case 'greedy-dijkstra':
          that.solverType = that.dijkstraWithGla;
          that.metric = areaCount;
          break;
        case 'dijkstra-greedy':
          that.solverType = that.glaWithDijkstra;
          that.metric = areaCount;
          break;
        case 'dijkstra-dijkstra':
          that.solverType = that.dijkstraDijkstra;
          that.metric = areaCount;
          break;
        case 'max-perimeter-dijkstra':
          that.solverType = that.dijkstraWithGla;
          that.metric = perimeterCount;
          break;
        default:
          that.solverType = that.roundRobin;
          break;
      }

      game_moves = [];
      seed = 1;
      makeBlocks();
    });

    $('#solver_play').on('click', function (e) {
      _block_inspect_counter = 0;
      _block_filter_counter = 0;
      iterations = $('#solver_iterations').val();
      max_moves = $('#solver_max_moves').val();
      scale_factor = $('#solver_scale_factor').val();
      start_time = performance.now();
      time = start_time;
      that.run();
    });

    this.runAlgorithm = function() {
      this.solverType();
      if (this.index === null) {
        this.index = 0;
      } else {
        controls[this.index].updateGameBoard();
      }
      this.solver.css('background-color', colors[this.index || 0]);
    }

    this.roundRobin = function() {
      this.index = (this.index + 1) % controls.length;
    }

    this.roundRobinWithSkipping = function() {
      do {
        this.index = (this.index + 1) % controls.length;
      } while (controls[this.index].checkGameBoard(1, nullMetric) === 0);
    }

    this.randomChoice = function() {
      this.index = randomInt(0, controls.length - 1);
    }

    this.randomChoiceWithSkipping = function() {
      do {
        this.index = randomInt(0, controls.length - 1);
      } while (controls[this.index].checkGameBoard(1, nullMetric) === 0);
    }

    this.greedy = function() {
      var max_control = _.max(controls, function(control) {
        return control.checkGameBoard(1, that.metric);
      });
      this.index = max_control.index;
    }

    this.greedyLookAhead = function() {
      var max_control = _.max(controls, function(control) {
        var matches = control.checkGameBoard(1, that.metric);
        if (matches === 0) {
          return 0;
        }
        return greedyLookAheadN(2, control, matches);
      });
      this.index = max_control.index;
    }

    function greedyLookAheadN(move, prev_control, prev_matches) {
      return _.max(_.map(controls, function(control) {
        if (control === prev_control) {
          return 0;
        }
        var matches = control.checkGameBoard(move, that.metric);
        if (matches === prev_matches || move >= max_moves) {
          return matches;
        }
        return greedyLookAheadN(move + 1, control, matches);
      }));
    }

    this.bfsWithGla = function() {
      if (moves < 18 || bfs() === false) this.greedyLookAhead();
    }

    function bfs() {
      var nodes = addNodes(new Queue(), 1, null);
      var still_adding_nodes = true;
      while (nodes.getLength() > 0) {
        var node = nodes.dequeue();
        markers = null;
        markers = node.markers;

        if (node.control.checkGameBoard(node.depth, endOfGame)) {
          doMarkedMoves();
          return true;
        }

        if (still_adding_nodes) {
          nodes = addNodes(nodes, node.depth + 1, node.control);
          still_adding_nodes = nodes.getLength() < 16384;
        }

        node.markers = null;
      }

      return false;
    }

    function addNodes(nodes, depth, prev_control) {
      var markers_dup = markers.slice();
      _.each(controls, function (control) {
        if (control !== prev_control) {
          nodes.enqueue({markers: markers_dup, depth: depth, control: control});
        }
      });

      return nodes;
    }

    function doMarkedMoves() {
      var move_sequence = markers.slice();
      var move = 1;
      var i = _.indexOf(move_sequence, move);
      while (i > 0) {
        var control = _.findWhere(controls, {color: blocks[i].color});
        control.updateGameBoard();
        move += 1;
        i = _.indexOf(move_sequence, move);
      }
    }

    this.dfs = function() {
      if (moves < 18) {
        this.greedyLookAhead();
        return;
      }

      var state = {min_moves: 30, moves: null, stop_time: performance.now() + 60000, n: 0};

      _.each(controls, function(control) {
        var matches = control.checkGameBoard(1, that.metric);
        if (matches === 0) return;
        state = dfsNext(2, control, matches, state);
      });

      console.log("Nodes: " + state.n);
      markers = state.moves;
      doMarkedMoves();
    }

    function dfsNext(move, prev_control, prev_matches, state) {
      state.n++;
      if (performance.now() > state.stop_time) return state;

      for (var i = 0; i < 5; i++) {
        var control = controls[(i + move) % 5];
        if (control === prev_control || move >= state.min_moves) continue;

        var matches = control.checkGameBoard(move, that.metric);
        if (matches === prev_matches) continue;

        if (endOfGame()) {
          console.log("Found new min moves " + move + " at time " + performance.now());
          state.min_moves = move;
          state.moves = markers.slice();
          continue;
        }

        state = dfsNext(move + 1, control, matches, state);
      };

      return state;
    }

    this.max_depth = 0;
    this.max_cleared = 0;

    this.dijkstra = function(blocks_to_clear = 600) {
      var vertices = addVertices(new PriorityQueue({ comparator: function(a, b) { return a.cost - b.cost } }), 1, null, blocks[0].cluster.blocks.length);
      this.max_depth = 0;
      while (vertices.length > 0) {
        var vertex = vertices.dequeue();
        markers = null;
        markers = vertex.markers;

        if (vertices.length > 250000 || vertex.cleared >= blocks_to_clear) {
          doMarkedMoves();
          vertices.clear();
        } else {
          vertices = addVertices(vertices, vertex.depth + 1, vertex.control, vertex.cleared);
        }

        vertex.markers = null;
      }
      this.index = null;
    }

    function markersCorrupt() {
      var move = 0;
      var max_move = _.max(markers);
      while(_.contains(markers, move)) move++;
      return move !== max_move + 1;
    }

    function addVertices(vertices, depth, prev_control, prev_cleared) {
      if (depth > that.max_depth || prev_cleared > that.max_cleared) {
        console.log("depth: " + depth + " cleared " + prev_cleared + ", n: " + vertices.length);
        if (depth > that.max_depth) that.max_depth = depth;
        if (prev_cleared > that.max_cleared) that.max_cleared = prev_cleared;
      }
      var stop = false;
      _.each(controls, function (control) {
        if (control !== prev_control && !stop) {
          var removed_blocks = control.checkGameBoard(depth, markedBlockCount);
          if (endOfGame()) {
            doMarkedMoves();
            vertices.clear();
            stop = true;
          } else if (removed_blocks - prev_cleared > 0) {
            var markers_dup = markers.slice();
            var cost = scale_factor*depth - removed_blocks;
            if (removed_blocks > 590 ||
                removed_blocks > 564 && vertices.length > 200000) {
              cost -= (scale_factor - 5)*depth;
            }
            vertices.queue({markers: markers_dup, depth: depth, control: control, cost: cost, cleared: removed_blocks});
          }
        }
      });

      return vertices;
    }

    this.dijkstraWithGla = function() {
      if (moves < 15) this.greedyLookAhead();
      else this.dijkstra();
    }

    this.glaWithDijkstra = function() {
      if (moves < 5) this.dijkstra(300);
      else this.greedyLookAhead();
    }

    this.dijkstraDijkstra = function() {
      if (moves < 5) this.dijkstra(300);
      else {
        scale_factor = 28;
        this.dijkstra();
      }
    }

    this.solverType = this.roundRobin;

    this.run = function _run() {
      that.runAlgorithm();
      if (moves === 0) {
        iterations -= 1;
        console.log("iteration " + iterations + " runtime: " + (performance.now() - time));
        time = performance.now();
      }

      if (iterations === 0) {
        calculate_stats();
        var end_time = performance.now();
        console.log("Run time: " + (end_time - start_time) / 1000.0);
        console.log("Block inspections: " + _block_inspect_counter);
        console.log("Block filters: " + _block_filter_counter);
      } else {
        setTimeout(_run, 10);
      }
    }

    function calculate_stats() {
      console.log(game_moves.toString());
      $('#max').text('Max: ' + _.max(game_moves));
      $('#min').text('Min: ' + _.min(game_moves));

      var sum = _.reduce(game_moves, function(a, b) { return a + b; });
      var mean = sum / game_moves.length;
      $('#mean').text('Mean: ' + Math.round(mean*100) / 100);

      var sum_squares = _.reduce(game_moves, function(a, b) { return a + Math.pow(b - mean, 2); }, 0);
      var stdev = Math.sqrt(sum_squares / game_moves.length);
      $('#stdev').text('Stdev: ' + Math.round(stdev*100) / 100);
    }
  }

  function nullMetric() {}

  // TODO areaCount is mis-counting, compared to markedBlockCount - they should be the same.
  function areaCount() {
    return _.reduce(clusters, function (count, cluster) {
      if (0 === markers[cluster.blocks[0].position]) return count;
      return count + cluster.blocks.length;
    }, 0);
  }

  function markedBlockCount() {
    return _.filter(markers, function (marker) { return marker !== 0; }).length + blocks[0].cluster.blocks.length;
  }

  function perimeterCount() {
    var count = _.reduce(blocks, function (accum, block) {
      if (markers[block.position] === 0) return accum;
      return accum + _.filter(block.getNeighbors(), function (neighbor) {
        return markers[blocks[neighbor].position] === 0 && !blocks[neighbor].isDead;
      }).length;
    }, 0);

    if (count === 0) return areaCount();
    return count;
  }

  function perimeterAreaHybrid() {
    if (moves >= 20) return areaCount();
    return perimeterCount();
  }

  function ratioCalc() {
    var area = areaCount();
    if (area === 0) return area;
    return perimeterCount() / area;
  }

  function ratioAreaHybrid() {
    if (moves >= 12) return areaCount();
    return ratioCalc();
  }

  function endOfGame() {
    return _.all(blocks, function (block) {
      return block.isDead || markers[block.position] !== 0;
    });
  }

  function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  function randomInt(min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  function makeBlocks() {
    var x = 0;
    var y = 0;

    blocks = [];
    clusters = [];
    markers = [];
    moves = 0;

    $('#gameboard').html('');
    $('#wrapper').css({
      'width': block_size * grid_length,
      'height': block_size * grid_height
    });

    _.each(_.range(grid_length * grid_height), function (num) {
      var color = colors[randomInt(0, 4)];
      var dead = false;

      if (num == 0) {
        dead = true;
        color = "#d9d9d9";
      }

      blocks.push(new Block(x, y, color, num, dead));
      markers.push(0);

      x += block_size;
      if (x >= grid_length * block_size) {
        y += block_size;
        x = 0;
      }
    });

    clusters.push(new Cluster(blocks[0]));
    _.each(blocks[0].cluster.neighbors, function (neighbor) {
      neighbor.neighbors = _.without(neighbor.neighbors, blocks[0].cluster);
    });
  };
}

$(document).on('ready page:load', function() {
  colorWalk();
});

