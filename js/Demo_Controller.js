/// <reference path="cytoscape.js" />

var posts_dataset;
var users_dataset;

// will be used to store graph data
var cy;

// This is called when the page is loaded.
window.onload = function () {

    var getJSON = function (url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'json';
        xhr.onload = function () {
            var status = xhr.status;
            if (status === 200) {
                callback(null, xhr.response);
            } else {
                callback(status, xhr.response);
            }
        };
        xhr.send();
    };

    getJSON('/DemoDataset/posts.json',
        function (err, data) {
            if (err !== null) {
                alert('Something went wrong: ' + err);
            } else {
                posts_dataset = data;
                getJSON('/DemoDataset/users.json',
                    function (err, data) {
                        if (err !== null) {
                            alert('Something went wrong: ' + err);
                        } else {
                            users_dataset = data;
                            DataDidload();
                        }
                    });
            }
        });


}

var DataDidload = function () {
    var mypair = pair(posts_dataset);
    var links = mypair.links;
    var users = cUserData(users_dataset);

    var data = users.concat(links);

    document.getElementById("informationArea").innerText = "-Demo dataset-\n";
    document.getElementById("informationArea").innerText += posts_dataset.length + " feeds\n";
    document.getElementById("informationArea").innerText += mypair.likeCount + " likes\n";

    dataToGraph(data);
}

var updateUserIDInPosts = function (oldID, newID) {
    for (var i = 0; i < posts_dataset.length; i++) {
        var _post = posts_dataset[i];

        for (var j = 0; j < _post.likes.length; j++) {
            var _like = _post.likes[j];
            if (_like.id == oldID) {
                _like.id = newID.toString();
            }
        }

    }
}

var pair = function (postData) {
    var links = [];
    var likeCount = 0;
    var _length = postData.length;
    for (var p = 0; p < _length; p++) {

        var _post = postData[p];
        var likes = _post.likes;

        for (var i = 0; i < likes.length; i++) {
            likeCount++;
            for (var j = i + 1; j < likes.length; j++) {

                var pair = {};
                pair.data = {};
                pair.data.id = likes[i].id + "-" + likes[j].id;
                pair.data.source = likes[i].id;
                pair.data.target = likes[j].id;
                links.push(pair);
            }
        }
    }
    return { links: links, likeCount: likeCount };
}

// Converts users data got from Facebook into cytoscape.js input format.
var cUserData = function (users) {
    var data = [];
    for (var i = 0; i < users.length; i++) {
        var user = {};
        user.data = {};
        user.data.id = users[i].id;
        user.data.name = users[i].name;
        data.push(user);
    }
    return data;
}

// Converts links data got from Facebook into cytoscape.js input format.
var cPairData = function (pairs) {
    var data = [];
    for (var i = 0; i < pairs.length; i++) {
        var user = {};
        user.data = {};
        user.data.id = pairs[i].a.id + "-" + pairs[i].b.id;
        user.data.source = pairs[i].a.id;
        user.data.target = pairs[i].b.id;
        data.push(user);
    }
    return data;
}

// Renders the network graph
var render = function (Gdata, target) {
    var cy = cytoscape({
        container: document.getElementById(target), // container to render in

        elements: Gdata,

        style: [ // the stylesheet for the graph
            {
                selector: 'node',
                style: {
                    'background-color': '#666',
                    'label': 'data(name)'
                }
            },

            {
                selector: 'edge',
                style: {
                    'width': 3,
                    'line-color': '#CCC',
                    'opacity': 0.33,
                }
            },
            {
                selector: '.highlighted',
                style: {
                    'background-color': '#61bffc'
                }
            }
        ],

        layout: {
            name: 'cose',

            // Called on `layoutready`
            ready: function () { },

            // Called on `layoutstop`
            stop: function () { },

            // Whether to animate while running the layout
            animate: true,

            // The layout animates only after this many milliseconds
            // (prevents flashing on fast runs)
            animationThreshold: 250,

            // Number of iterations between consecutive screen positions update
            // (0 -> only updated on the end)
            refresh: 20,

            // Whether to fit the network view after when done
            fit: true,

            // Padding on fit
            padding: 30,

            // Constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
            boundingBox: undefined,

            // Extra spacing between components in non-compound graphs
            componentSpacing: 100,

            // Node repulsion (non overlapping) multiplier
            nodeRepulsion: function (node) { return 400000; },

            // Node repulsion (overlapping) multiplier
            nodeOverlap: 10,

            // Ideal edge (non nested) length
            idealEdgeLength: function (edge) { return 10; },

            // Divisor to compute edge forces
            edgeElasticity: function (edge) { return 100; },

            // Nesting factor (multiplier) to compute ideal edge length for nested edges
            nestingFactor: 5,

            // Gravity force (constant)
            gravity: 80,

            // Maximum number of iterations to perform
            numIter: 1000,

            // Initial temperature (maximum node displacement)
            initialTemp: 200,

            // Cooling factor (how the temperature is reduced between consecutive iterations
            coolingFactor: 0.95,

            // Lower temperature threshold (below this point the layout will end)
            minTemp: 1.0,

            // Whether to use threading to speed up the layout
            useMultitasking: true
        }
    });

}

// Find the most rumor centralized node.
var dataToGraph = function (data) {

    // dumps data
    cy = cytoscape({
        elements: data
    });

    // Creats cy2 for BFS
    cy2 = cytoscape();

    // Finds all components
    var comps = cy.elements().components();

    // Do BFS for each components
    for (var i = 0; i < comps.length; i++) {
        var bfs = cy.elements().bfs({
            roots: '#' + comps[i][0].id(),
            visit: function (i, depth) {
                // example of finding desired node
                if (this.data('weight') > 70) {
                    return true;
                }

                // example of exiting search early
                if (this.data('weight') < 0) {
                    return false;
                }
            },
            directed: false
        });
        cy2.add(bfs.path); // path to found node
    }

    // calc ccn for each node
    var maxCnnValue = 0;
    var maxCnnNode = null;

    var nodes = cy2.nodes().forEach(function (node) {
        var cnn = cy2.$().ccn().closeness('#' + node.id());
        node.data("cnn", cnn);
        if (cnn > maxCnnValue) {
            maxCnnValue = cnn;
            maxCnnNode = node;
        }
    }, this);

    // now cy nodes data has property cnn
    cy.$('#' + maxCnnNode.id()).addClass('highlighted');

    // rendder the network graph
    render(cy.elements().jsons(), "demo-canvas3");
}