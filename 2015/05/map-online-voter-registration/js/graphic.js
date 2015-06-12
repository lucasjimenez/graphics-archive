// global vars
var $graphic = null;
var $mapTemplate = null;
var pymChild = null;

var MOBILE_THRESHOLD = 500;
var GRAPHIC_DEFAULT_WIDTH = 600;

var COLORS = {
    'red1': '#6C2315', 'red2': '#A23520', 'red3': '#D8472B', 'red4': '#E27560', 'red5': '#ECA395', 'red6': '#F5D1CA',
    'orange1': '#714616', 'orange2': '#AA6A21', 'orange3': '#E38D2C', 'orange4': '#EAAA61', 'orange5': '#F1C696', 'orange6': '#F8E2CA',
    'yellow1': '#77631B', 'yellow2': '#B39429', 'yellow3': '#EFC637', 'yellow4': '#F3D469', 'yellow5': '#F7E39B', 'yellow6': '#FBF1CD',
    'teal1': '#0B403F', 'teal2': '#11605E', 'teal3': '#17807E', 'teal4': '#51A09E', 'teal5': '#8BC0BF', 'teal6': '#C5DFDF',
    'blue1': '#28556F', 'blue2': '#3D7FA6', 'blue3': '#51AADE', 'blue4': '#7DBFE6', 'blue5': '#A8D5EF', 'blue6': '#D3EAF7'
};


/*
 * Initialize
 */
var onWindowLoaded = function() {
    if (Modernizr.svg) {
        $graphic = $('#graphic');
        $mapTemplate = $('#map-template');

        pymChild = new pym.Child({
            renderCallback: render
        });
    } else {
        pymChild = new pym.Child({ });
    }
}


/*
 * RENDER THE GRAPHIC
 */
var render = function(containerWidth) {
    var graphicWidth;

    // fallback if page is loaded outside of an iframe
    if (!containerWidth) {
        containerWidth = GRAPHIC_DEFAULT_WIDTH;
    }

    // check the container width; set mobile flag if applicable
    if (containerWidth <= MOBILE_THRESHOLD) {
        isMobile = true;
    } else {
        isMobile = false;
    }

    // clear out existing graphics
    $graphic.empty();

    // draw the new graphic
    // (this is a separate function in case I want to be able to draw multiple charts later.)
    drawMap('category', MAP_DATA);

    // update iframe
    if (pymChild) {
        pymChild.sendHeight();
    }
}

/*
 * Determine unique categories
 */
var makeCategories = function(data) {
    var categories = [];
    _.each(data, function(state) {
        if (state['category'] != null) {
            categories.push(state['category']);
        }
    });
    return d3.set(categories).values().sort();
}


/*
 * Build and render a legend from map categories
 */
var renderLegend = function($el, color) {
    _.each(color.domain(), function(key, i) {
        var $item = $('<li class="key-item"><label>' + key + '</label></li>')
        var $color = $('<b style="background:' + color(key) + '"></b>');
        $color.prependTo($item);
        $item.appendTo($el);
    });
}

/*
 * DRAW THE GRAPH
 */
var drawMap = function(id, mapData) {
    // create div for this map
    $graphic.append('<div id="map-' + id + '" class="tile-grid-map"></div>')
    var $el = $('#map-' + id);

    // append map template
    $el.append($mapTemplate.html());

    // define color range
    var color = d3.scale.ordinal()
        .domain(makeCategories(mapData))
        .range([ COLORS['blue1'], COLORS['blue3'], COLORS['blue5'], COLORS['orange3'], COLORS['teal3'] ]);

    // make the legend
    var $legend = $el.find('.key');
    renderLegend($legend, color);

    // flip the colors where a category is defined
    _.each(mapData, function(state) {
        if (state['category'] !== null) {
            var stateClass = 'state-' + classify(state['state_name']);
            $el.find('.' + stateClass)
                .attr('class', stateClass + ' state-active')
                .attr('fill', color(state['category']));
        }
    });

    // Draw labels
    var svg = d3.select('#' + $el.attr('id') + ' svg');
    var stateLabels = svg.append('g')
        .selectAll('text')
            .data(mapData)
        .enter().append('text')
            .attr('text-anchor', 'middle')
            .text(function(d) {
                var state = _.findWhere(STATE_NAMES, { 'name': d['state_name'] });
                var name = state['name'];
                var postalCode = state['usps'];
                var ap = state['ap'];

                return isMobile ? postalCode : ap;
            })
            .attr('class', function(d) {
                return d['category'] !== null ? 'label label-active' : 'label';
            })
            .attr('x', function(d) {
                var className = '.state-' + classify(d['state_name']);
                var tileBox = svg.select(className)[0][0].getBBox();

                return tileBox['x'] + tileBox['width'] * 0.52;
            })
            .attr('y', function(d) {
                var className = '.state-' + classify(d['state_name']);
                var tileBox = svg.select(className)[0][0].getBBox();
                var textBox = d3.select(this)[0][0].getBBox();
                var textOffset = textBox['height'] / 2;

                return (tileBox['y'] + tileBox['height'] * 0.5) + textOffset;
            });
}

/*
 * HELPER FUNCTIONS
 */
var classify = function(str) { // clean up strings to use as CSS classes
    return str.replace(/\s+/g, '-').toLowerCase();
}


/*
 * Initially load the graphic
 * (NB: Use window.load instead of document.ready
 * to ensure all images have loaded)
 */
$(window).load(onWindowLoaded);
