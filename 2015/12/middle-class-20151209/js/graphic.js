// Global vars
var pymChild = null;
var isMobile = false;

/*
 * Initialize the graphic.
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
}

/*
 * Format graphic data for processing by D3.
 */
var formatData = function() {
    DATA.forEach(function(d) {
        var x0 = 0;

        d['values'] = [];

        for (var key in d) {
            if (key == 'label' || key == 'values') {
                continue;
            }

            d[key] = +d[key];

            var x1 = x0 + d[key];

            d['values'].push({
                'name': key,
                'x0': x0,
                'x1': x1,
                'val': d[key]
            })

            x0 = x1;
        }
    });
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
    renderStackedBarChart({
        container: '#stacked-bar-chart',
        width: containerWidth,
        data: DATA
    });

    // Update iframe
    if (pymChild) {
        pymChild.sendHeight();
    }
}

/*
 * Render a stacked bar chart.
 */
var renderStackedBarChart = function(config) {
    /*
     * Setup
     */
    var labelColumn = 'label';

    var barHeight = 30;
    var barGap = 5;
    var labelWidth = 30;
    var labelMargin = 6;
    var valueGap = 6;

    var margins = {
        top: 20,
        right: 20,
        bottom: 20,
        left: (labelWidth + labelMargin)
    };

    var ticksX = 4;
    var roundTicksFactor = 50;

    if (isMobile) {
        ticksX = 2;
    }

    // Calculate actual chart dimensions
    var chartWidth = config['width'] - margins['left'] - margins['right'];
    var chartHeight = ((barHeight + barGap) * config['data'].length);

    // Clear existing graphic (for redraw)
    var containerElement = d3.select(config['container']);
    containerElement.html('');

    /*
     * Create D3 scale objects.
     */
     var min = d3.min(config['data'], function(d) {
         var lastValue = d['values'][d['values'].length - 1];

         return Math.floor(lastValue['x1'] / roundTicksFactor) * roundTicksFactor;
     });

     if (min > 0) {
         min = 0;
     }

     var max = 100;

     var xScale = d3.scale.linear()
         .domain([min, max])
         .rangeRound([0, chartWidth]);

     var colorScale = d3.scale.ordinal()
         .domain(d3.keys(config['data'][0]).filter(function(d) {
             return d != labelColumn && d != 'values';
         }))
         .range([ COLORS['blue2'], '#aaa', '#ccc' ]);

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
        .tickValues([0,50,100])
        .tickFormat(function(d) {
            return d + '%';
        });

    /*
     * Render axes to chart.
     */
    chartElement.append('g')
        .attr('class', 'x axis')
        .attr('transform', makeTranslate(0, chartHeight))
        .call(xAxis);

    /*
     * Render bars to chart.
     */
     var group = chartElement.selectAll('.group')
         .data(config['data'])
         .enter().append('g')
             .attr('class', function(d) {
                 return 'group ' + classify(d[labelColumn]);
             })
             .attr('transform', function(d,i) {
                 return 'translate(0,' + (i * (barHeight + barGap)) + ')';
             });

     group.selectAll('rect')
         .data(function(d) {
             return d['values'];
         })
         .enter().append('rect')
             .attr('x', function(d) {
                 if (d['x0'] < d['x1']) {
                     return xScale(d['x0']);
                 }

                 return xScale(d['x1']);
             })
             .attr('width', function(d) {
                 return Math.abs(xScale(d['x1']) - xScale(d['x0']));
             })
             .attr('height', barHeight)
             .style('fill', function(d) {
                 return colorScale(d['name']);
             })
             .attr('class', function(d) {
                 return classify(d['name']);
             });

    /*
     * Render axis grid to chart.
     */
    var xAxisGrid = function() {
        return xAxis;
    };

    chartElement.append('g')
        .attr('class', 'x grid')
        .attr('transform', makeTranslate(0, chartHeight))
        .call(xAxisGrid()
            .tickSize(-chartHeight, 0, 0)
            .tickFormat('')
        );

    /*
     * Render bar category labels (instead of a color legend)
     */
    chartElement.append('g')
            .attr('class', 'bar-categories')
            .selectAll('text')
                .data(chartElement.select('.group').datum()['values'])
                .enter().append('text')
                .attr('class', function(d) {
                    return 'bar-category-label ' + classify(d['name']);
                })
                .attr('transform', function(d,i) {
                    var xVal;

                    if (i > 0) {
                        xVal = xScale(d['x1']) - valueGap;
                    } else {
                        xVal = xScale(d['x0']) + valueGap;
                    }

                    return 'translate(' + xVal + ', -5)';
                })
                .text(function(d,i) {
                    var textVal = d['name'];

                    if (!isMobile || i === 0) {
                        textVal = textVal + ' income';
                    }

                    return textVal;
                });

     /*
      * Render bar values.
      */
     group.append('g')
        .attr('class', 'value')
        .selectAll('text')
        .data(function(d) {
            return d['values'];
        })
        .enter().append('text')
            .text(function(d) {
                if (d['val'] != 0) {
                    return (Math.round(10*d['val'])/10).toFixed(1) + '%';
                }
            })
            .attr('class', function(d) {
                return classify(d['name']);
            })
            .attr('x', function(d,i) {
                if (i > 0) {
                    return xScale(d['x1']);
                }

 				return xScale(d['x0']);
            })
            .attr('dx', function(d,i) {
                var textWidth = this.getComputedTextLength();
                var barWidth = Math.abs(xScale(d['x1']) - xScale(d['x0']));

                // Hide labels that don't fit
                if (textWidth + valueGap * 1.3 > barWidth) {
                    d3.select(this).classed('hidden', true)
                }

                if (d['x1'] < 0) {
                    return valueGap;
                }

                if (i === 0) {
                    return valueGap;
                }

                return -(valueGap + textWidth);
            })
            .attr('dy', (barHeight / 2) + 4)

    /*
     * Render 0-line.
     */
    if (min < 0) {
        chartElement.append('line')
            .attr('class', 'zero-line')
            .attr('x1', xScale(0))
            .attr('x2', xScale(0))
            .attr('y1', 0)
            .attr('y2', chartHeight);
    }

    /*
     * Render bar labels.
     */
    chartWrapper.append('ul')
        .attr('class', 'labels')
        .attr('style', formatStyle({
            'width': labelWidth + 'px',
            'top': margins['top'] + 'px',
            'left': '0'
        }))
        .selectAll('li')
        .data(config['data'])
        .enter()
        .append('li')
            .attr('style', function(d, i) {
                return formatStyle({
                    'width': labelWidth + 'px',
                    'height': barHeight + 'px',
                    'left': '0px',
                    'top': (i * (barHeight + barGap)) + 'px;'
                });
            })
            .attr('class', function(d) {
                return 'label-' + classify(d[labelColumn]);
            })
            .append('span')
                .text(function(d) {
                    return parseInt(d[labelColumn], 10);
                });
}

/*
 * Initially load the graphic
 * (NB: Use window.load to ensure all images have loaded)
 */
window.onload = onWindowLoaded;
