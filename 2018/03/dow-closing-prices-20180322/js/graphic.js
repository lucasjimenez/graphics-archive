// Global vars
var pymChild = null;
var isMobile = false;
var dataSeries = [];
var axisLabels = [];
var highlightData = {
    start: '3/21/18',
    end: '3/22/18'
};

/*
 * Initialize graphic
 */
var onWindowLoaded = function() {
    if (Modernizr.svg) {
        formatData();

        pymChild = new pym.Child({
            renderCallback: render
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
 * Format graphic data for processing by D3.
 */
var formatData = function() {
    DATA.forEach(function(d) {
        d['date'] = d3.time.format('%m/%d/%y').parse(d['date']);

        for (var key in d) {
            if (key == 'label_axis' && d[key] != null) {
                axisLabels.push(d['date']);
            } else if (key != 'date' && key != 'label_point' && d[key] != null && d[key].length > 0) {
                d[key] = +d[key];
            }
        }
    });

    /*
     * Restructure tabular data for easier charting.
     */
    for (var column in DATA[0]) {
        if (column == 'date' || column == 'label_axis' || column == 'label_point') {
            continue;
        }

        dataSeries.push({
            'name': column,
            'values': DATA.map(function(d) {
                return {
                    'date': d['date'],
                    'amt': d[column],
                    'label_point': d['label_point']
                };
    // filter out empty data. uncomment this if you have inconsistent data.
    //        }).filter(function(d) {
    //            return d['amt'] != null;
            })
        });
    }
}

/*
 * Render the graphic(s). Called by pym with the container width.
 */
var render = function(containerWidth) {
    if (!containerWidth) {
        containerWidth = DEFAULT_WIDTH;
    }

    if (containerWidth <= MOBILE_THRESHOLD) {
        isMobile = true;
    } else {
        isMobile = false;
    }

    // Render the chart!
    renderLineChart({
        container: '#line-chart',
        width: containerWidth,
        data: dataSeries
    });

    // Update iframe
    if (pymChild) {
        pymChild.sendHeight();
    }
}

/*
 * Render a line chart.
 */
var renderLineChart = function(config) {
    /*
     * Setup
     */
    var dateColumn = 'date';
    var valueColumn = 'amt';

    var aspectWidth = isMobile ? 4 : 16;
    var aspectHeight = isMobile ? 3 : 9;

    var margins = {
        top: 5,
        right: isMobile ? 60 : 105,
        bottom: isMobile ? 30 : 20,
        left: 45
    };

    var ticksX = 5;
    var ticksY = 5;
    var roundTicksFactor = 2000;

    // Calculate actual chart dimensions
    var chartWidth = config['width'] - margins['left'] - margins['right'];
    var chartHeight = Math.ceil((config['width'] * aspectHeight) / aspectWidth) - margins['top'] - margins['bottom'];

    // Clear existing graphic (for redraw)
    var containerElement = d3.select(config['container']);
    containerElement.html('');

    /*
     * Create D3 scale objects.
     */
    var xScale = d3.time.scale()
        .domain(d3.extent(config['data'][0]['values'], function(d) {
            return d['date'];
        }))
        .range([ 0, chartWidth ])

    var min = d3.min(config['data'], function(d) {
        return d3.min(d['values'], function(v) {
            return Math.floor(v[valueColumn] / roundTicksFactor) * roundTicksFactor;
        })
    });

    min = 18000;

    //if (min > 0) {
        //min = 0;
    //}

    var max = d3.max(config['data'], function(d) {
        return d3.max(d['values'], function(v) {
            return Math.ceil(v[valueColumn] / roundTicksFactor) * roundTicksFactor;
        })
    });

    var yScale = d3.scale.linear()
        .domain([min, max])
        .range([chartHeight, 0]);

    var colorScale = d3.scale.ordinal()
        .domain(_.pluck(config['data'], 'name'))
        .range([COLORS['teal3'], COLORS['yellow3'], COLORS['blue3'], COLORS['orange3'], COLORS['teal3']]);

    /*
     * Create the root SVG element.
     */
    var chartWrapper = containerElement.append('div')
        .attr('class', 'graphic-wrapper');

    var chartElement = chartWrapper.append('svg')
        .attr('width', chartWidth + margins['left'] + margins['right'])
        .attr('height', chartHeight + margins['top'] + margins['bottom'])
        .append('g')
        .attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

    /*
     * Create D3 axes.
     */
    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient('bottom')
        //.tickValues(axisLabels)
        .ticks(ticksX)
        .tickFormat(function(d, i) {
            return formatFullDate(d);
        });

    var yAxis = d3.svg.axis()
        .scale(yScale)
        .orient('left')
        .ticks(ticksY);

    /*
     * Render axes to chart.
     */
    chartElement.append('g')
        .attr('class', 'x axis')
        .attr('transform', makeTranslate(0, chartHeight))
        .call(xAxis);

    if (isMobile) {
        chartElement.selectAll('.x.axis .tick text')
            .attr('dy', '7px')
            .call(wrapText, chartWidth / 4, 12);
    }

    chartElement.append('g')
        .attr('class', 'y axis')
        .call(yAxis);

    /*
     * Render grid to chart.
     */
    var xAxisGrid = function() {
        return xAxis;
    }

    var yAxisGrid = function() {
        return yAxis;
    }

    chartElement.append('g')
        .attr('class', 'x grid')
        .attr('transform', makeTranslate(0, chartHeight))
        .call(xAxisGrid()
            .tickSize(-chartHeight, 0, 0)
            .tickFormat('')
        );

    chartElement.append('g')
        .attr('class', 'y grid')
        .call(yAxisGrid()
            .tickSize(-chartWidth, 0, 0)
            .tickFormat('')
        );

    /*
     * Render 0 value line.
     */
    if (min < 0) {
        chartElement.append('line')
            .attr('class', 'zero-line')
            .attr('x1', 0)
            .attr('x2', chartWidth)
            .attr('y1', yScale(0))
            .attr('y2', yScale(0));
    }

    var dateParser = d3.time.format('%m/%d/%y');
    var highlightXStart = xScale(dateParser.parse(highlightData['start']));
    var highlightXEnd = xScale(dateParser.parse(highlightData['end']));

    var highlightArea = chartElement.append('g')
        .attr('class', 'highlight-area');

    highlightArea
        .append('rect')
            .attr('height', chartHeight)
            .attr('width', highlightXEnd - highlightXStart)
            .attr('x', highlightXStart);

    highlightArea
        .append('text')
        .attr('x', highlightXStart + (highlightXEnd - highlightXStart)/2)
        .attr('y', isMobile ? 7 : 30)
        .text('Drop of 724 points on March 22')
        .call(wrapText, margins['right'], 12);

    /*
     * Render lines to chart.
     */
    var line = d3.svg.line()
        //.interpolate('monotone')
        .x(function(d) {
            return xScale(d[dateColumn]);
        })
        .y(function(d) {
            return yScale(d[valueColumn]);
        });

    chartElement.append('g')
        .attr('class', 'lines')
        .selectAll('path')
        .data(config['data'])
        .enter()
        .append('path')
            .attr('class', function(d, i) {
                return 'line ' + classify(d['name']);
            })
            .attr('stroke', function(d) {
                return colorScale(d['name']);
            })
            .attr('d', function(d) {
                return line(d['values']);
            });

    var labelData = config['data'][0]['values'].filter(function(d) { return d['label_point']; });

    chartElement.append('g')
        .attr('class', 'dots')
        .selectAll('circle')
        .data(labelData)
        .enter().append('circle')
            .attr('cx', function(d) {
                return xScale(d[dateColumn]);
            })
            .attr('cy', function(d) {
                return yScale(d[valueColumn]);
            })
            .attr('r', isMobile ? 3 : 4);

    chartElement.append('g')
        .attr('class', 'value')
        .selectAll('text')
        .data(labelData)
        .enter().append('text')
            .attr('x', function(d, i) {
                return xScale(d[dateColumn]) + 5;
            })
            .attr('y', function(d, i) {
                var yOffset = isMobile && i == 0 ? -3 : 5;
                return yScale(d[valueColumn]) + yOffset;
            })
            .text(function(d) {
                var value = fmtComma(d[valueColumn].toFixed(0));
                var monthFmt = getAPMonth(d[dateColumn]);
                var dayFmt = +d3.time.format('%d')(d[dateColumn]);

                return monthFmt + ' ' + dayFmt + ': ' + value;
            })
            .call(wrapText, margins['right'], isMobile ? 10 : 14);
}

/*
 * Initially load the graphic
 * (NB: Use window.load to ensure all images have loaded)
 */
window.onload = onWindowLoaded;
