'use strict'

module.exports = createOrbiter

var createController = require('orbit-camera-controller')
var mouseChange      = require('mouse-change')
var mouseWheel       = require('mouse-wheel')
var now              = require('right-now')

function copyVec(a, b) {
  a[0] = b[0]
  a[1] = b[1]
  a[2] = b[2]
}

function Orbiter(element, controller) {
  this.element        = element
  this.controller     = controller
  this.matrix         = new Array(16)
  this.rotation       = new Array(4)
  this.up             = new Array(3)
  this.eye            = new Array(3)
  this.center         = new Array(3)
  this.distance       = 0.0
  this.delay          = 40
  this.inputEnabled   = true
  this.flipX          = false
  this.flipY          = false
  this.translateSpeed = 1
  this.zoomSpeed      = 1
  this.rotateSpeed    = 1
  this.changed        = true
}

var proto = Orbiter.prototype

proto.toJSON = function() {
  var t = this.lastT()
  controller.recalcMatrix(t)
  return {
    camera:         this.controller.toJSON(),
    delay:          this.delay,
    flipX:          this.flipX,
    flipY:          this.flipY,
    translateSpeed: this.translateSpeed,
    zoomSpeed:      this.zoomSpeed,
    rotateSpeed:    this.rotateSpeed
  }
}

proto.fromJSON = function(options) {
  if('camera' in options) {
    this.controller.fromJSON(options.camera)
  }

  var self = this
  function handleOption(prop) {
    if(prop in options) {
      self[prop] = options[prop]
    }
  }
  handleOption('delay')
  handleOption('inputEnabled')
  handleOption('flipX')
  handleOption('flipY')
  handleOption('translateSpeed')
  handleOption('zoomSpeed')
  handleOption('rotateSpeed')
  this.changed = true
}

proto.tick = function() {
  var t = now()
  var delay = this.delay
  var controller = this.controller
  controller.idle(t - 0.5 * delay)
  controller.flush(t - (1000 * (1 + Math.min(delay,0))))
  controller.recalcMatrix(t - delay)

  var prevMat = this.matrix
  var nextMat = controller.computedMatrix
  var changed = this.changed
  for(var i=0; i<16; ++i) {
    changed = changed || (Math.abs(nextMat[i] - prevMat[i]) > 1e-5)
    prevMat[i] = nextMat[i]
  }

  var prevRot = this.rotation
  var nextRot = controller.computedRotation
  for(var i=0; i<4; ++i) {
    prevRot[i] = nextRot[i]
  }

  copyVec(this.eye,    controller.computedEye)
  copyVec(this.up,     controller.computedUp)
  copyVec(this.center, controller.computedCenter)
  this.distance = Math.exp(controller.computedRadius[0])

  //Clear change flag
  this.changed = false

  return changed
}

proto.lookAt = function(eye, center, up) {
  this.controller.lookAt(this.lastT(), eye, center, up)
}

proto.setMatrix = function(mat) {
  this.controller.setMatrix(this.lastT(), mat)
}

proto.setDistance = function(d) {
  this.controller.setDistance(this.lastT(), d)
}

proto.setDistanceLimits = function(lo, hi) {
  this.controller.setDistanceLimits(lo, hi)
}

proto.rotate = function(pitch, yaw, roll) {
  this.controller.rotate(now(), pitch, yaw, roll)
}

proto.pan = function(dx, dy, dz) {
  this.controller.pan(now(), dx, dy, dz)
}

proto.translate = function(dx, dy, dz) {
  this.controller.translate(now(), dx, dy, dz)
}

proto.lastT = function() {
  return this.controller.lastT()
}

function createOrbiter(element, options) {

  //Create orbiter
  var controller = createController(options)
  var orbiter = new Orbiter(element, controller)
  orbiter.fromJSON(options)
  orbiter.tick()
  orbiter.changed = true

  //Hook input handlers
  var lastX = 0, lastY = 0
  mouseChange(element, function(buttons, x, y, mods) {
    if(!orbiter.inputEnabled) {
      return
    }

    var height = element.clientHeight
    var width  = element.clientWidth

    var scale = 1.0 / height
    var dx    = scale * (x - lastX)
    var dy    = scale * (y - lastY)
    var t     = now()

    var flipX = orbiter.flipX ? 1 : -1
    var flipY = orbiter.flipY ? 1 : -1

    var vrot  = Math.PI * orbiter.rotateSpeed
    var vpan  = +orbiter.translateSpeed
    var vzoom = +orbiter.zoomSpeed

    var distance = orbiter.distance

    if(buttons & 1) {
      if(mods.shift) {
        controller.rotate(t, 0, 0, -dx * drot)
      } else {
        controller.rotate(t, flipX * vrot * dx, -flipY * vrot * dy, 0)
      }
    } else if(buttons & 2) {
      controller.pan(t, -vpan * dx * distance * height / width, vpan * dy * distance, 0)
    } else if(buttons & 4) {
      controller.pan(t, 0, 0, vzoom * dy * distance)
    }

    lastX = x
    lastY = y
  })

  mouseWheel(element, function(dx, dy, dz) {
    if(!orbiter.inputEnabled) {
      return
    }

    var t        = now()
    var flipX    = orbiter.flipX ? 1 : -1
    var vrot     = Math.PI * orbiter.rotateSpeed
    var vzoom    = +orbiter.zoomSpeed
    var distance = orbiter.distance

    if(Math.abs(dx) > Math.abs(dy)) {
      controller.rotate(t, 0, 0, -dx * flipX * vrot / window.innerWidth)
    } else {
      controller.pan(t, 0, 0, vzoom * dy / window.innerHeight * distance)
    }
  }, true)


  element.addEventListener('contextmenu', function(ev) {
    if(orbiter.inputEnabled) {
      ev.preventDefault()
      return false
    }
  })

  return orbiter
}