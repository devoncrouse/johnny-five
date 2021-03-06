var Board = require("../lib/board.js");

var priv = new WeakMap(),
    leds = [];

/**
 * Led
 * @constructor
 *
 * five.Led(pin);
 *
 * five.Led({
 *   pin: number
 *  });
 *
 *
 * @param {Object} opts [description]
 *
 */

function Led( opts ) {

  if ( !(this instanceof Led) ) {
    return new Led( opts );
  }

  // Initialize a Device instance on a Board
  Board.Device.call(
    this, opts = Board.Options( opts )
  );

  // LED instance properties
  this.value = 0;
  this.interval = null;

  // TODO: use pin capability checks for LED value writing.

  // Create a "state" entry for privately
  // storing the state of the led
  leds.push( this );

  priv.set( this, {
    isOn: false,
    isRunning: false,
    value: 0,
    direction: 1,
    mode: null
  });

  Object.defineProperties( this, {
    value: {
      get: function() {
        return priv.get( this ).value;
      }
    },
    isOn: {
      get: function() {
        return priv.get( this ).isOn;
      }
    },
    isRunning: {
      get: function() {
        return priv.get( this ).isRunning;
      }
    },
    pinMode: {
      set: function( mode ) {
        var state = priv.get( this );
        // set pinMode
        // TODO: if setting to PWM, check if this pin is capable of PWM
        // log error if not capable
        if ( state.mode !== mode ) {
          state.mode = mode;
          this.firmata.pinMode( this.pin, mode );
        }
      },
      get: function() {
        return priv.get( this ).mode;
      }
    }
  });

  this.pin = opts && opts.pin || 9;
  this.pinMode = this.firmata.MODES[ opts.type && opts.type.toUpperCase() || "OUTPUT" ];
}

/**
 * on Turn the led on
 * @return {Led}
 */
Led.prototype.on = function() {
  var state = priv.get( this );

  if ( state.mode === this.firmata.MODES.OUTPUT ) {
    this.firmata.digitalWrite( this.pin, this.firmata.HIGH );
  }

  if ( state.mode === this.firmata.MODES.PWM ) {
    this.firmata.analogWrite( this.pin, state.value );
  }

  state.isOn = true;

  return this;
};

/**
 * off  Turn the led off
 * @return {Led}
 */
Led.prototype.off = function() {
  var state = priv.get( this );

  if ( state.mode === this.firmata.MODES.OUTPUT ) {
    this.firmata.digitalWrite( this.pin, this.firmata.LOW );
  }

  if ( state.mode === this.firmata.MODES.PWM ) {
    this.firmata.analogWrite( this.pin, 0 );
  }

  state.isOn = false;

  return this;
};

/**
 * toggle Toggle the on/off state of an led
 * @return {Led}
 */
Led.prototype.toggle = function() {
  var state = priv.get( this );

  if ( state.isOn ) {
    this.off();
  } else {
    this.on();
  }

  return this;
};

/**
 * brightness
 * @param  {Number} value analog brightness value 0-255
 * @return {Led}
 */
Led.prototype.brightness = function( value ) {
  var state = priv.get( this );

  // If pin is not a PWM pin, emit an error
  if ( !this.board.pins.isPwm(this.pin) ) {
    Board.Pins.Error({
      pin: this.pin,
      type: "PWM",
      via: "Led",
    });
  }

  // Reset pinMode to PWM
  this.pinMode = this.firmata.MODES.PWM;

  this.firmata.analogWrite( this.pin, value );

  state.value = value;

  return this;
};

/**
 * pulse Fade the Led in and out in a loop with specified time
 * @param  {number} rate Time in ms that a fade in/out will elapse
 * @return {Led}
 */
Led.prototype.pulse = function( time ) {
  var direction, to, state;
  to = ( time || 1000 ) / ( 255 * 2 );
  state = priv.get( this );

  if ( !this.board.pins.isPwm(this.pin) ) {
    Board.Pins.Error({
      pin: this.pin,
      type: "PWM",
      via: "Led",
    });
  }

  // Avoid traffic jams when pulse() is called
  // more then once on the same instance, with no
  // calls to stop()
  if ( this.interval ) {
    clearInterval( this.interval );

    // Use the previous direction
    direction = state.direction;
  }

  // Ensure pinMode is PWM
  this.pinMode = this.firmata.MODES.PWM;

  state.isOn = true;
  state.isRunning = true;

  this.interval = setInterval(function() {
    var valueAt = this.value;

    // If state.isOn is true, then change
    // the visible state of the LED
    if ( state.isOn ) {
      if ( valueAt === 0 ) {
        direction = 1;
      }

      if ( valueAt === 255 ) {
        direction = -1;
      }

      this.firmata.analogWrite(
        this.pin, valueAt + direction
      );
      state.value = valueAt + direction;
      state.direction = direction;
    }
  }.bind(this), to);

  return this;
};

/**
 * fade Fade an led in and out
 * @param  {Number} val  Analog brightness value 0-255
 * @param  {Number} time Time in ms that a fade in/out will elapse
 * @return {Led}
 */
Led.prototype.fade = function( val, time ) {
  var direction, to, state;
  direction = this.value <= val ? 1 : -1;
  to = ( time || 1000 ) / ( (val || 255) * 2 );
  state = priv.get( this );

  if ( !this.board.pins.isPwm(this.pin) ) {
    Board.Pins.Error({
      pin: this.pin,
      type: "PWM",
      via: "Led",
    });
  }

  // Avoid traffic jams
  if ( this.interval ) {
    clearInterval( this.interval );
  }

  // Reset pinMode to PWM
  this.pinMode = this.firmata.MODES.PWM;
  state.isOn = true;

  this.interval = setInterval(function() {
    var valueAt = this.value;

    // If state.isOn is true, then change
    // the visible state of the LED
    if ( state.isOn ) {
      if ( (direction > 0 && valueAt === 255) ||
            (direction < 0 && valueAt === 0) ||
              valueAt === val ) {

        this.stop();
      } else {
        this.firmata.analogWrite(
          this.pin, valueAt + direction
        );
        state.value = valueAt + direction;
        state.direction = direction;
      }
    }
  }.bind(this), to);

  return this;
};

Led.prototype.fadeIn = function( time ) {
  return this.fade( 255, time || 1000 );
};

Led.prototype.fadeOut = function( time ) {
  return this.fade( 0, time || 1000 );
};

/**
 * strobe
 * @param  {Number} rate Time in ms to strobe/blink
 * @return {Led}
 */
Led.prototype.strobe = function( rate ) {
  var isHigh, state;
  isHigh = false;
  state = priv.get( this );

  // Avoid traffic jams
  if ( this.interval ) {
    clearInterval( this.interval );
  }


  // Reset pinMode to OUTPUT
  this.pinMode = this.firmata.MODES.OUTPUT;

  state.isOn = true;
  state.isRunning = true;
  state.value = this.value;

  this.interval = setInterval(function() {
    // If state.isOn is true, then change
    // the visible state of the LED
    if ( state.isOn ) {
      if ( isHigh ) {
        this.firmata.digitalWrite(
          this.pin, this.firmata.LOW
        );
      } else {
        this.firmata.digitalWrite(
          this.pin, this.firmata.HIGH
        );
      }
      isHigh = !isHigh;
    }
  }.bind(this), rate || 100 );

  return this;
};

/**
 * stop Stop the led from strobing, pulsing or fading
 * @return {Led}
 */
Led.prototype.stop = function() {
  var state = priv.get( this );

  clearInterval( this.interval );

  state.isOn = false;
  state.isRunning = false;
  state.value = this.value;

  return this;
};



// TODO:
// Led.prototype.color = function() {
//   ...
//   return this;
// };


/**
 * Led.Array()
 * new Led.Array()
 *
 * Create an Array-like object instance of leds
 *
 * @return {Led.Array}
 */
Led.Array = function() {
  if ( !(this instanceof Led.Array) ) {
    return new Led.Array();
  }

  this.length = 0;

  leds.forEach(function( led, index ) {
    this[ index ] = led;

    this.length++;
  }, this );
};



/**
 * each Execute callbackFn for each active led instance in an Led.Array
 * @param  {Function} callbackFn
 * @return {Led.Array}
 */
Led.Array.prototype.each = function( callbackFn ) {
  var led, i, length;

  length = this.length;

  for ( i = 0; i < length; i++ ) {
    led = this[i];
    callbackFn.call( led, led, i );
  }

  return this;
};

/**
 * pulse Pulse all Leds
 *
 * @return {Led.Array}
 *
 * strobe Strobe all Leds
 *
 * @return {Led.Array}
 *
 */

[

  "on", "off", "toggle", "brightness",
  "fade", "fadeIn", "fadeOut",
  "pulse", "strobe",
  "stop"

].forEach(function( method ) {
  // Create Led.Array wrappers for each method listed.
  // This will allow us control over all Led instances
  // simultaneously.
  Led.Array.prototype[ method ] = function() {
    var args = [].slice.call( arguments );

    this.each(function( led ) {
      Led.prototype[ method ].apply( led, args );
    });
    return this;
  };
});


module.exports = Led;
