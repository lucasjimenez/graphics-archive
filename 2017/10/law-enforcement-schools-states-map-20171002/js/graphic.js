/**
 * Render a hex map  of U.S. States.
 *
 * I've modified this slightly from the default script created by the template
 * to use fewer global variables.
 */

// Global config
var MAP_TEMPLATE_ID = '#map-template';

// Global vars
var pymChild = null;
var isMobile = false;

/*
 * Get a color scale given a min and max value.
 *
 * See
 */
var palette = function (min, max) {
    var d = (max-min)/7;
    return d3.scale.threshold()
        // .range(['#c5dfdf','#a5c3c2','#86a7a6','#688c8b','#4a7170','#2d5957','#0b403f'])
        .range(['#f8f4cd','#bbd4cd','#77b5cb','#2f94bb','#1e7392','#0d526b','#003446'])
        .domain([min+1*d,min+2*d,min+3*d,min+4*d,min+5*d,min+6*d,min+7*d]);
};

/**
 * Get a color scale.
 */
var getColorScale = function(data, isNumeric, categories, colors) {
    var colorScale;

    if (isNumeric) {
        // Unlike the default template, use a threshold scale instead of an
        // ordinal scale so we can map from our raw pecentage value to a
        // color.
        // We use one generated by the Chroma.js Color Scale Helper because
        // there aren't quite enough colors in our color variables to get
        // the number of breaks needed to give us both clean break numbers
        // and small enough bins.
        colorScale = palette(0, .7);
    } else {
        // Define color scale
        colorScale = d3.scale.ordinal()
            .domain(categories)
            .range([
                colors['red3'],
                colors['yellow3'],
                colors['blue3'],
                colors['orange3'],
                colors['teal3']
            ]);
    }

    return colorScale;
};

/**
 * Extract categories from data.
 */
function getCategories(data, labels) {
    var categories = [];

    if (labels['legend_labels'] && labels['legend_labels'] !== '') {
        // If custom legend labels are specified
        var legendLabels = labels['legend_labels'].split(',');
        _.each(legendLabels, function(label) {
            categories.push(label.trim());
        });
    } else {
        // Default: Return sorted array of categories
         _.each(config['data'], function(state) {
            if (state[valueColumn] != null) {
                categories.push(state[valueColumn]);
            }
        });

        categories = d3.set(categories).values().sort();
    }

    return categories;
};

/*
 * Initialize the graphic.
 */
var onWindowLoaded = function() {
    var isNumeric = (LABELS['is_numeric'] && LABELS['is_numeric'].toLowerCase() == 'true');
    var categories = getCategories(DATA, LABELS);
    var colorScale = getColorScale(
        DATA,
        isNumeric,
        categories,
        COLORS
    );

    if (Modernizr.svg) {
        pymChild = new pym.Child({
            // .bind() sets the default values for some of our parameters.
            // This is called a partially-applied function.
            renderCallback: render.bind(
                null,
                '#state-grid-map',
                categories,
                colorScale,
                DATA,
                LABELS,
                isNumeric
            )
        });
    } else {
        pymChild = new pym.Child({});
    }

    pymChild.onMessage('on-screen', function(bucket) {
        ANALYTICS.trackEvent('on-screen', bucket);
    });
    pymChild.onMessage('scroll-depth', function(data) {
        data = JSON.parse(data);
        ANALYTICS.trackEvent('scroll-depth', data.percent, data.seconds);
    });
}

/*
 * Render the graphic(s). Called by pym with the container width.
 */
var render = function(container, categories, colorScale, data, labels, isNumeric, containerWidth) {
    if (!containerWidth) {
        containerWidth = DEFAULT_WIDTH;
    }

    if (containerWidth <= MOBILE_THRESHOLD) {
        isMobile = true;
    } else {
        isMobile = false;
    }

    // Render the map!
    renderStateGridMap({
        container: container,
        colorScale: colorScale,
        categories: categories,
        width: containerWidth,
        data: data,
        labels: labels,
        // isNumeric will style the legend as a numeric scale
        isNumeric: isNumeric
    });

    // Update iframe
    if (pymChild) {
        pymChild.sendHeight();
    }
}


/*
 * Render a state grid map.
 */
var renderStateGridMap = function(config) {
    var valueColumn = 'pct_schools_with_officer';

    // Clear existing graphic (for redraw)
    var containerElement = d3.select(config['container']);
    containerElement.html('');

    // Copy map template
    var template = d3.select(MAP_TEMPLATE_ID);
    containerElement.html(template.html());

    // Extract categories from data

    // Create legend
    var legendWrapper = containerElement.select('.key-wrap');
    var legendElement = containerElement.select('.key');

    legendWrapper.classed('numeric-scale', config['isNumeric']);

    _.each(config.categories, function(key, i) {
        var keyItem = legendElement.append('li')
            .classed('key-item', true)

        var keyAsPct = parseInt(key, 10) / 100;
        keyItem.append('b')
            .style('background', config.colorScale(keyAsPct));

        keyItem.append('label')
            .text(key);

        // Add the optional upper bound label on numeric scale
        if (config['isNumeric'] && i == config.categories.length - 1) {
            if (config.labels['max_label'] && config.labels['max_label'] !== '') {
                keyItem.append('label')
                    .attr('class', 'end-label')
                    .text(config.labels['max_label']);
            }
        }
    });

    // Select SVG element
    var chartElement = containerElement.select('svg');

    // resize map (needs to be explicitly set for IE11)
    chartElement.attr('width', config['width'])
        .attr('height', function() {
            var s = d3.select(this);
            var viewBox = s.attr('viewBox').split(' ');
            return Math.floor(config['width'] * parseInt(viewBox[3]) / parseInt(viewBox[2]));
        });

    // Set state colors
    _.each(config['data'], function(state) {
        if (state[valueColumn] !== null) {
            var stateClass = 'state-' + classify(state['state_name']);
            var categoryClass = 'category-' + classify(state[valueColumn]);

            chartElement.select('.' + stateClass)
                .attr('class', stateClass + ' state-active ' + categoryClass)
                .attr('fill', config.colorScale(state[valueColumn]));
        }
    });

    // Draw state labels
    chartElement.append('g')
        .selectAll('text')
            .data(config['data'])
        .enter().append('text')
            .attr('text-anchor', 'middle')
            .text(function(d) {
                var state = _.findWhere(STATES, { 'name': d['state_name'] });

                console.log(state);

                return isMobile ? state['usps'] : state['ap'];
            })
            .attr('class', function(d) {
                return d[valueColumn] !== null ? 'category-' + classify(d[valueColumn]) + ' label label-active' : 'label';
            })
            .attr('x', function(d) {
                var className = '.state-' + classify(d['state_name']);
                var tileBox = chartElement.select(className)[0][0].getBBox();

                return tileBox['x'] + tileBox['width'] * 0.52;
            })
            .attr('y', function(d) {
                var className = '.state-' + classify(d['state_name']);
                var tileBox = chartElement.select(className)[0][0].getBBox();
                var textBox = d3.select(this)[0][0].getBBox();
                var textOffset = textBox['height'] / 2;

                if (isMobile) {
                    textOffset -= 1;
                }

                return (tileBox['y'] + tileBox['height'] * 0.5) + textOffset;
            });
}

/*
 * Initially load the graphic
 * (NB: Use window.load to ensure all images have loaded)
 */
window.onload = onWindowLoaded;