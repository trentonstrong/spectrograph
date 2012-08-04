/*
 * Primary namespace
 */
 var SCS = window.SCS = SCS || {};

/*
 * The buffer size determines the number of storage elements allocated for a discrete signal.
 * Larger buffer sizes allow for the representation of signals with either higher resolution
 * (higher sample rate) or longer length, given that one of the two is fixed.
 *
 * For example, given the default 2048 element buffer and a sample rate of 44100 Hz,
 * the maximum length (in the time domain) of a signal is
 *
 *       1
 *  ----------- * 2048 = .046... seconds
 *    44100 Hz
 *
 * By doubling the buffer size, we could either store a signal that was twice as long
 * at 44.1 KHz or store the same length signal at 88.2 Khz
 *
 */
 SCS.DEFAULT_BUFFER_SIZE = 2048;

/*
 * The sample rate specifies the rate at which "samples" -- discrete measurements of
 * a time domain signal taken at even intervals -- are taken.  The default value of
 * 44.1 KHz specifies that each element in the signal buffer represents the observed
 * value of the original signal at evenly spaced intervals of ~22 μs.
 *
 */
 SCS.DEFAULT_SAMPLE_RATE = 44100;

/*
 * The bandwidth represents the size (in Hz) of the discrete frequency "buckets"
 * or more commonly, "bands", in the frequency domain.  An intuitive
 * explanation of frequency bands is that since we are dealing with *discrete* time
 * domain signals, our knowledge of the exact frequencies in a signal is limited in
 * direct relationship to the number of times we can observe the signal in a given time
 * interval.  Therefore, the frequency information tends to "smear" around the frequency bands
 * and effectively average the frequency values around the center (mean) of each band.
 *
 * This is not to be confused with the cutoff frequency, which is determined by the Nyquist
 * sample rate and caused by the inability of a discrete time signal to distinguish frequencies
 * that oscillate a certain amount faster than sample interval.
 *
 * A more detailed mathematical explanation requires a bit more knowledge of the continuous time
 * Fourier transform.  The so-called "Bandpass" theorem is a mathematical derivation of the following.
 */
 SCS.DEFAULT_BANDWIDTH = 2.0 / SCS.DEFAULT_BUFFER_SIZE * SCS.DEFAULT_SAMPLE_RATE / 2.0;


/*
 * Returns the band frequency an index represents in the frequency domain buffer.
 */
 SCS.getBandFrequency = function(index) {
    return SCS.DEFAULT_BANDWIDTH * index + SCS.DEFAULT_BANDWIDTH / 2.0;
};


SCS.Window = new WindowFunction(DSP.HANN);

SCS.SampleCollection = Backbone.Collection.extend({
    model: SCS.SignalModel,

    getFFT: function() {

        var fft = new FFT(SCS.DEFAULT_BUFFER_SIZE, SCS.DEFAULT_SAMPLE_RATE);
        fft.forward(this.getTotalSignal());
        return fft;
    }
});

SCS.Samples = new SCS.SampleCollection;

SCS.SignalTransformGraphView = Backbone.View.extend({
    className: 'graph',

    initialize: function(options) {
        this.width = options.width || 640;
        this.height = options.height || 480;
        this.margin = {top: 10, right: 10, bottom: 20, left: 40} || options.margin;
        this.width = this.width - this.margin.left - this.margin.right,
        this.height = this.height - this.margin.top - this.margin.bottom;

        this.chart = d3.select(this.el)
            .append("svg")
            .attr("class", "chart")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        // define gradient for signal bars
        var gradient = this.chart.append("svg:defs")
            .append("svg:linearGradient")
            .attr("id", "signalGradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%")
            .attr("spreadMethod", "pad");
        gradient.append("svg:stop")
            .attr("offset", "0%")
            .attr("stop-color", "#DA70D6")
            .attr("stop-opacity", 1);
        gradient.append("svg:stop")
            .attr("offset", "50%")
            .attr("stop-color", "#9932CC")
            .attr("stop-opacity", 1);
        gradient.append("svg:stop")
            .attr("offset", "100%")
            .attr("stop-color", "#2E0854")
            .attr("stop-opacity", 1);

        // frequency axis
        var frequency = d3.scale.linear()
            .domain([0, SCS.DEFAULT_BUFFER_SIZE / 2.0])
            .range([0, SCS.getBandFrequency(SCS.DEFAULT_BUFFER_SIZE / 2.0)])

        var x = d3.scale.linear()
            .domain([0, frequency(SCS.DEFAULT_BUFFER_SIZE / 2.0)])
            .rangeRound([0, this.width]);

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom")

        this.chart.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + this.height + ")")
            .call(xAxis);

        // initialize rects 0 height to enable transform animation on first render
        var that = this;
        var zeroes = _.map(_.range(0, SCS.DEFAULT_BUFFER_SIZE / 2.0), Math.zeroFunction);        
        this.chart.selectAll("rect")
            .data(zeroes)
            .enter()
            .append("rect")
            .attr("x", function(d, i) { return x(frequency(i)); })
            .attr("y", function(d) { return that.height; })
            .attr("width", function(d) { return 1.0; })
            .attr("height", function(d) { return d; });

        this.collection.on("all", this.render, this);
    },

    render: function() {
        this.chart.select("g.y").remove();

        var fft = this.collection.getFFT();
        var spectrum = _.map(fft.spectrum, Math.toDecibels);
        var spectrumMax = d3.max(spectrum);
        spectrum = _.map(spectrum, function(s) { return s - spectrumMax; }); // normalize to 0 db
        var spectrumMin = d3.min(spectrum);
        
        var y = d3.scale.linear()
            .domain([spectrumMin, 0.0])
            .range([this.height, 0]);

        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left")

        this.chart.append("g")
            .attr("class", "y axis")
            .call(yAxis);

        var that = this;
        this.chart.selectAll("rect")
            .data(spectrum)
            .transition()
            .attr("style", function(d) { return "fill:url(#signalGradient);"; })
            .attr("y", function(d) { return y(d) - 0.5; })
            .attr("height", function(d) { return that.height - y(d); });

       return this; 
    }
});



SCS.ApplicationView = Backbone.View.extend({

    events: {
        'click #scSearchBtn': 'doTrackSearch',
        'click .sc-track-link': 'handleTrackSelection'
    },

    searchResultsTemplate: _.template($('#scSearchResultsTemplate').html()),

    initialize: function(options) {
        _.bindAll(this);
        this.$('.tabs').tabs();
        this.transformView = new SCS.SignalTransformGraphView({
            width: options.width || 900,
            height: options.height || 400,
            collection: SCS.Samples
        });

        this.$('#signalTransformTab').append(this.transformView.el);
    },

    doTrackSearch: function(event) {
        var query = this.$('#scSearchQuery').val().trim();
        SC.get('/tracks', { q: query }, this.showTrackResults);
    },

    showTrackResults: function(tracks) {
        var streamableTracks = _.filter(tracks, function(track) {
            return track.streamable;
        });
        this.$('#scSearchResults').html(this.searchResultsTemplate({ tracks: streamableTracks }));
    },

    handleTrackSelection: function(event) {
        event.preventDefault();
        $.getJSON('/')
    },

    addSignal: function(signal) {
        var signalView = new SCS.SignalView({
            model: signal
        });
        this.$('.signal-panel >.new').before(signalView.render().el);
    }
});

SCS.BlackbodySpectrum = ["#ff3300", "#ff3800", "#ff4500", "#ff4700", "#ff5200", "#ff5300", "#ff5d00", "#ff5d00", "#ff6600", "#ff6500", "#ff6f00", "#ff6d00", "#ff7600", "#ff7300", "#ff7c00", "#ff7900", "#ff8200", "#ff7e00", "#ff8700", "#ff8300", "#ff8d0b", "#ff8912", "#ff921d", "#ff8e21", "#ff9829", "#ff932c", "#ff9d33", "#ff9836", "#ffa23c", "#ff9d3f", "#ffa645", "#ffa148", "#ffaa4d", "#ffa54f", "#ffae54", "#ffa957", "#ffb25b", "#ffad5e", "#ffb662", "#ffb165", "#ffb969", "#ffb46b", "#ffbd6f", "#ffb872", "#ffc076", "#ffbb78", "#ffc37c", "#ffbe7e", "#ffc682", "#ffc184", "#ffc987", "#ffc489", "#ffcb8d", "#ffc78f", "#ffce92", "#ffc994", "#ffd097", "#ffcc99", "#ffd39c", "#ffce9f", "#ffd5a1", "#ffd1a3", "#ffd7a6", "#ffd3a8", "#ffd9ab", "#ffd5ad", "#ffdbaf", "#ffd7b1", "#ffddb4", "#ffd9b6", "#ffdfb8", "#ffdbba", "#ffe1bc", "#ffddbe", "#ffe2c0", "#ffdfc2", "#ffe4c4", "#ffe1c6", "#ffe5c8", "#ffe3ca", "#ffe7cc", "#ffe4ce", "#ffe8d0", "#ffe6d2", "#ffead3", "#ffe8d5", "#ffebd7", "#ffe9d9", "#ffedda", "#ffebdc", "#ffeede", "#ffece0", "#ffefe1", "#ffeee3", "#fff0e4", "#ffefe6", "#fff1e7", "#fff0e9", "#fff3ea", "#fff2ec", "#fff4ed", "#fff3ef", "#fff5f0", "#fff4f2", "#fff6f3", "#fff5f5", "#fff7f5", "#fff6f8", "#fff8f8", "#fff8fb", "#fff9fb", "#fff9fd", "#fff9fd", "#fef9ff", "#fefaff", "#fcf7ff", "#fcf8ff", "#f9f6ff", "#faf7ff", "#f7f5ff", "#f7f5ff", "#f5f3ff", "#f5f4ff", "#f3f2ff", "#f3f3ff", "#f0f1ff", "#f1f1ff", "#eff0ff", "#eff0ff", "#edefff", "#eeefff", "#ebeeff", "#eceeff", "#e9edff", "#eaedff", "#e7ecff", "#e9ecff", "#e6ebff", "#e7eaff", "#e4eaff", "#e5e9ff", "#e3e9ff", "#e4e9ff", "#e1e8ff", "#e3e8ff", "#e0e7ff", "#e1e7ff", "#dee6ff", "#e0e6ff", "#dde6ff", "#dfe5ff", "#dce5ff", "#dde4ff", "#dae4ff", "#dce3ff", "#d9e3ff", "#dbe2ff", "#d8e3ff", "#dae2ff", "#d7e2ff", "#d9e1ff", "#d6e1ff", "#d8e0ff", "#d4e1ff", "#d7dfff", "#d3e0ff", "#d6dfff", "#d2dfff", "#d5deff", "#d1dfff", "#d4ddff", "#d0deff", "#d3ddff", "#cfddff", "#d2dcff", "#cfddff", "#d1dcff", "#cedcff", "#d0dbff", "#cddcff", "#cfdaff", "#ccdbff", "#cfdaff", "#cbdbff", "#ced9ff", "#cadaff", "#cdd9ff", "#c9daff", "#ccd8ff", "#c9d9ff", "#ccd8ff", "#c8d9ff", "#cbd7ff", "#c7d8ff", "#cad7ff", "#c7d8ff", "#cad6ff", "#c6d8ff", "#c9d6ff", "#c5d7ff", "#c8d5ff", "#c4d7ff", "#c8d5ff", "#c4d6ff", "#c7d4ff", "#c3d6ff", "#c6d4ff", "#c3d6ff", "#c6d4ff", "#c2d5ff", "#c5d3ff", "#c1d5ff", "#c5d3ff", "#c1d4ff", "#c4d2ff", "#c0d4ff", "#c4d2ff", "#c0d4ff", "#c3d2ff", "#bfd3ff", "#c3d1ff", "#bfd3ff", "#c2d1ff", "#bed3ff", "#c2d0ff", "#bed2ff", "#c1d0ff", "#bdd2ff", "#c1d0ff", "#bdd2ff", "#c0cfff", "#bcd2ff", "#c0cfff", "#bcd1ff", "#bfcfff", "#bbd1ff", "#bfceff", "#bbd1ff", "#beceff", "#bad0ff", "#beceff", "#bad0ff", "#beceff", "#b9d0ff", "#bdcdff", "#b9d0ff", "#bdcdff", "#b9cfff", "#bccdff", "#b8cfff", "#bcccff", "#b8cfff", "#bcccff", "#b7cfff", "#bbccff", "#b7ceff", "#bbccff", "#b7ceff", "#bbcbff", "#b6ceff", "#bacbff", "#b6ceff", "#bacbff", "#b6cdff", "#bacbff", "#b5cdff", "#b9caff", "#b5cdff", "#b9caff", "#b5cdff", "#b9caff", "#b4cdff", "#b8caff", "#b4ccff", "#b8c9ff", "#b4ccff", "#b8c9ff", "#b3ccff", "#b8c9ff", "#b3ccff", "#b7c9ff", "#b3ccff", "#b7c9ff", "#b2cbff", "#b7c8ff", "#b2cbff", "#b6c8ff", "#b2cbff", "#b6c8ff", "#b2cbff", "#b6c8ff", "#b1cbff", "#b6c8ff", "#b1caff", "#b5c7ff", "#b1caff", "#b5c7ff", "#b1caff", "#b5c7ff", "#b0caff", "#b5c7ff", "#b0caff", "#b4c7ff", "#b0caff", "#b4c6ff", "#afc9ff", "#b4c6ff", "#afc9ff", "#b4c6ff", "#afc9ff", "#b3c6ff", "#afc9ff", "#b3c6ff", "#afc9ff", "#b3c6ff", "#aec9ff", "#b3c5ff", "#aec9ff", "#b3c5ff", "#aec8ff", "#b2c5ff", "#aec8ff", "#b2c5ff", "#adc8ff", "#b2c5ff", "#adc8ff", "#b2c5ff", "#adc8ff", "#b2c4ff", "#adc8ff", "#b1c4ff", "#adc8ff", "#b1c4ff", "#acc7ff", "#b1c4ff", "#acc7ff", "#b1c4ff", "#acc7ff", "#b1c4ff", "#acc7ff", "#b0c4ff", "#acc7ff", "#b0c3ff", "#abc7ff", "#b0c3ff", "#abc7ff", "#b0c3ff", "#abc7ff", "#b0c3ff", "#abc6ff", "#b0c3ff", "#abc6ff", "#afc3ff", "#aac6ff", "#afc3ff", "#aac6ff", "#afc2ff", "#aac6ff", "#afc2ff", "#aac6ff", "#afc2ff", "#aac6ff", "#afc2ff", "#aac6ff", "#aec2ff", "#a9c6ff", "#aec2ff", "#a9c5ff", "#aec2ff", "#a9c5ff", "#aec2ff", "#a9c5ff", "#aec2ff", "#a9c5ff", "#aec1ff", "#a9c5ff", "#aec1ff", "#a9c5ff", "#adc1ff", "#a8c5ff", "#adc1ff", "#a8c5ff", "#adc1ff", "#a8c5ff", "#adc1ff", "#a8c5ff", "#adc1ff", "#a8c4ff", "#adc1ff", "#a8c4ff", "#adc1ff", "#a8c4ff", "#adc0ff", "#a7c4ff", "#acc0ff", "#a7c4ff", "#acc0ff", "#a7c4ff", "#acc0ff", "#a7c4ff", "#acc0ff", "#a7c4ff", "#acc0ff", "#a7c4ff", "#acc0ff", "#a7c4ff", "#acc0ff", "#a6c4ff", "#acc0ff", "#a6c3ff", "#abc0ff", "#a6c3ff", "#abc0ff", "#a6c3ff", "#abbfff", "#a6c3ff", "#abbfff", "#a6c3ff", "#abbfff", "#a6c3ff", "#abbfff", "#a6c3ff", "#abbfff", "#a5c3ff", "#abbfff", "#a5c3ff", "#abbfff", "#a5c3ff", "#aabfff", "#a5c3ff", "#aabfff", "#a5c3ff", "#aabfff", "#a5c3ff", "#aabfff", "#a5c2ff", "#aabeff", "#a5c2ff", "#aabeff", "#a5c2ff", "#aabeff", "#a4c2ff", "#aabeff", "#a4c2ff", "#aabeff", "#a4c2ff", "#aabeff", "#a4c2ff", "#a9beff", "#a4c2ff", "#a9beff", "#a4c2ff", "#a9beff", "#a4c2ff", "#a9beff", "#a4c2ff", "#a9beff", "#a4c2ff", "#a9beff", "#a4c2ff", "#a9beff", "#a3c2ff", "#a9beff", "#a3c2ff", "#a9bdff", "#a3c1ff", "#a9bdff", "#a3c1ff", "#a9bdff", "#a3c1ff", "#a8bdff", "#a3c1ff", "#a8bdff", "#a3c1ff", "#a8bdff", "#a3c1ff", "#a8bdff", "#a3c1ff", "#a8bdff", "#a3c1ff", "#a8bdff", "#a3c1ff", "#a8bdff", "#a2c1ff", "#a8bdff", "#a2c1ff", "#a8bdff", "#a2c1ff", "#a8bdff", "#a2c1ff", "#a8bdff", "#a2c1ff", "#a8bdff", "#a2c1ff", "#a7bcff", "#a2c1ff", "#a7bcff", "#a2c1ff", "#a7bcff", "#a2c0ff", "#a7bcff", "#a2c0ff", "#a7bcff", "#a2c0ff", "#a7bcff", "#a2c0ff", "#a7bcff", "#a2c0ff", "#a7bcff", "#a1c0ff", "#a7bcff", "#a1c0ff", "#a7bcff", "#a1c0ff", "#a7bcff", "#a1c0ff", "#a7bcff", "#a1c0ff", "#a7bcff", "#a1c0ff", "#a7bcff", "#a1c0ff", "#a6bcff", "#a1c0ff", "#a6bcff", "#a1c0ff", "#a6bcff", "#a1c0ff", "#a6bbff", "#a1c0ff", "#a6bbff", "#a1c0ff", "#a6bbff", "#a1c0ff", "#a6bbff", "#a1c0ff", "#a6bbff", "#a0c0ff", "#a6bbff", "#a0c0ff", "#a6bbff", "#a0bfff", "#a6bbff", "#a0bfff", "#a6bbff", "#a0bfff", "#a6bbff", "#a0bfff", "#a6bbff", "#a0bfff", "#a6bbff", "#a0bfff", "#a6bbff", "#a0bfff", "#a5bbff", "#a0bfff", "#a5bbff", "#a0bfff", "#a5bbff", "#a0bfff", "#a5bbff", "#a0bfff", "#a5bbff", "#a0bfff", "#a5bbff", "#a0bfff", "#a5bbff", "#9fbfff", "#a5bbff", "#9fbfff", "#a5baff", "#9fbfff", "#a5baff", "#9fbfff", "#a5baff", "#9fbfff", "#a5baff", "#9fbfff", "#a5baff", "#9fbfff", "#a5baff", "#9fbfff", "#a5baff", "#9fbfff", "#a5baff", "#9fbfff", "#a5baff", "#9fbfff", "#a5baff", "#9fbeff", "#a5baff", "#9fbeff", "#a4baff", "#9fbeff", "#a4baff", "#9fbeff", "#a4baff", "#9fbeff", "#a4baff", "#9fbeff", "#a4baff", "#9fbeff", "#a4baff", "#9ebeff", "#a4baff", "#9ebeff", "#a4baff", "#9ebeff", "#a4baff", "#9ebeff", "#a4baff", "#9ebeff", "#a4baff", "#9ebeff", "#a4baff", "#9ebeff", "#a4baff", "#9ebeff", "#a4baff", "#9ebeff", "#a4b9ff", "#9ebeff", "#a4b9ff", "#9ebeff", "#a4b9ff", "#9ebeff", "#a4b9ff", "#9ebeff", "#a4b9ff", "#9ebeff", "#a4b9ff", "#9ebeff", "#a4b9ff", "#9ebeff", "#a3b9ff", "#9ebeff", "#a3b9ff", "#9ebeff", "#a3b9ff", "#9ebeff", "#a3b9ff", "#9ebeff", "#a3b9ff", "#9ebeff", "#a3b9ff", "#9dbeff", "#a3b9ff", "#9dbeff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b9ff", "#9dbdff", "#a3b8ff", "#9dbdff", "#a3b8ff", "#9dbdff", "#a2b8ff", "#9dbdff", "#a2b8ff", "#9dbdff", "#a2b8ff", "#9dbdff", "#a2b8ff", "#9dbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbdff", "#a2b8ff", "#9cbcff", "#a2b8ff", "#9cbcff", "#a2b8ff", "#9cbcff", "#a2b8ff", "#9cbcff", "#a2b8ff", "#9cbcff", "#a2b8ff", "#9cbcff", "#a2b8ff", "#9cbcff", "#a2b8ff", "#9cbcff", "#a2b8ff", "#9cbcff", "#a2b8ff", "#9cbcff", "#a2b8ff", "#9cbcff", "#a1b8ff", "#9cbcff", "#a1b8ff", "#9bbcff", "#a1b8ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff", "#a1b7ff", "#9bbcff"];