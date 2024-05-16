const webcamElement = document.getElementById('webcam');
const webcam = new Webcam(webcamElement, 'user');
const modelPath = 'models';
let currentStream;
let displaySize;
let convas;
let faceDetection;

webcam.start()
cameraStarted();

// For Happy
var neutralLeftAngle = 0;
var neutralRightAngle = 0;

// For Surprise
var neutralDistanceLipTopBottom = 0;

// For Anger
var neutralDistanceEyebrow = 0
var neutralLeftEyebrowSlope  = 0
var neutralRightEyebrowSlope = 0
var neutralEyebrowEyeDistanceLeft
var neutralEyebrowEyeDistanceRight

// * Thresholds
const happyAngleThreshold = 5;
const sadAngleThreshold = 2;
const lipDistanceThreshold = 10;
const eyebrowDistanceThreshold = 0;

const angerEyebrowThreshold = 5
const angerEyebrowEyeThreshold = 4
const angerSlopeThreshold = 0.15

document.getElementById('happyAngleThreshold').innerHTML = happyAngleThreshold
document.getElementById('sadAngleThreshold').innerHTML = sadAngleThreshold
document.getElementById('lipDistanceThreshold').innerHTML = lipDistanceThreshold
document.getElementById('eyebrowEyeDistanceThreshold').innerHTML = angerEyebrowEyeThreshold
document.getElementById('eyebrowSlopeThreshold').innerHTML = angerSlopeThreshold

var flag = 0
var predictedEmotion = null;


$("#webcam-switch").change(function () {
  if(this.checked){
      webcam.start()
          .then(result =>{
            cameraStarted();
            webcamElement.style.transform = "";
            console.log("webcam started");
          })
          .catch(err => {
              displayError();
          });
  }
  else {        
      cameraStopped();
      webcam.stop();
      console.log("webcam stopped");
  }        
});

$('#cameraFlip').click(function() {
    webcam.flip();
    webcam.start()
    .then(result =>{ 
      webcamElement.style.transform = "";
    });
});

$("#webcam").bind("loadedmetadata", function () {
  displaySize = { width:this.scrollWidth, height: this.scrollHeight }
});

$("#detection-switch").change(function () {
  if(this.checked){
    toggleContrl("box-switch", true);
    toggleContrl("landmarks-switch", true);
    toggleContrl("expression-switch", true);
    toggleContrl("age-gender-switch", true);
    $("#box-switch").prop('checked', true);
    $(".loading").removeClass('d-none');
    Promise.all([
      faceapi.nets.tinyFaceDetector.load(modelPath),
      faceapi.nets.faceLandmark68TinyNet.load(modelPath),
      faceapi.nets.faceExpressionNet.load(modelPath),
      faceapi.nets.ageGenderNet.load(modelPath)
    ]).then(function(){
      createCanvas();
      startDetection();
    })
  }
  else {
    clearInterval(faceDetection);
    toggleContrl("box-switch", false);
    toggleContrl("landmarks-switch", false);
    toggleContrl("expression-switch", false);
    toggleContrl("age-gender-switch", false);
    if(typeof canvas !== "undefined"){
      setTimeout(function() {
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
      }, 1000);
    }
  }        
});

function createCanvas(){
  if( document.getElementsByTagName("canvas").length == 0 )
  {
    canvas = faceapi.createCanvasFromMedia(webcamElement)
    document.getElementById('webcam-container').append(canvas)
    faceapi.matchDimensions(canvas, displaySize)
  }
}

function toggleContrl(id, show){
  if(show){
    $("#"+id).prop('disabled', false);
    $("#"+id).parent().removeClass('disabled');
  }else{
    $("#"+id).prop('checked', false).change();
    $("#"+id).prop('disabled', true);
    $("#"+id).parent().addClass('disabled');
  }
}

async function startDetection(){
  faceDetection = setInterval(async () => {
    const detections = await faceapi.detectAllFaces(webcamElement, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true).withFaceExpressions().withAgeAndGender()
    const resizedDetections = faceapi.resizeResults(detections, displaySize)
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    
    if (detections[0]){
      const landmarks = detections[0].landmarks
      const noseTop = landmarks._positions[27]
      const noseBottom = landmarks._positions[33]
      const lipLeft = landmarks._positions[48]
      const lipRight = landmarks._positions[54]
      const lipTop = landmarks._positions[51]
      const lipBottom = landmarks._positions[57]
      const eyebrowLeftCenter = landmarks._positions[21]
      const eyebrowRightCentre = landmarks._positions[22]

      // Calculate angle
      var leftAngle = calculateAngle(noseTop, noseBottom, lipLeft);
      var rightAngle = calculateAngle(noseTop, noseBottom, lipRight);
      var distanceLipTopBottom = calculateDistance(lipTop, lipBottom);
      var distanceEyebrow = calculateDistance(eyebrowRightCentre, eyebrowLeftCenter);

      var distanceEyebrowEyeRight  = calculateDistance(eyebrowRightCentre, landmarks._positions[39])
      var distanceEyebrowEyeLeft  = calculateDistance(eyebrowLeftCenter, landmarks._positions[42])

      var dominantEmotion = await getDominantEmotion(detections[0].expressions);

      if (dominantEmotion == 'neutral' && flag == 0) {
        neutralLeftAngle = Math.max(neutralLeftAngle, leftAngle);
        neutralRightAngle = Math.max(neutralRightAngle, rightAngle);
        neutralDistanceLipTopBottom = Math.max(neutralDistanceLipTopBottom, distanceLipTopBottom);
        neutralDistanceEyebrow = Math.max(neutralDistanceEyebrow, distanceEyebrow);
        neutralLeftEyebrowSlope = calculateSlope(landmarks._positions[21], landmarks._positions[17]); 
        neutralRightEyebrowSlope = calculateSlope(landmarks._positions[22], landmarks._positions[27]);
        neutralEyebrowEyeDistanceLeft = distanceEyebrowEyeLeft;
        neutralEyebrowEyeDistanceRight = distanceEyebrowEyeRight;
        
        flag = 1;
      }

      var currentAngleDeviationRight = neutralLeftAngle - leftAngle;
      var currentAngleDeviationLeft = neutralRightAngle - rightAngle;
      var lipDeviation = distanceLipTopBottom - neutralDistanceLipTopBottom;
      var eyebrowDeviation = distanceEyebrow - neutralDistanceEyebrow;

      // Calculate current slopes
      var currentLeftEyebrowSlope = calculateSlope(landmarks._positions[21], landmarks._positions[17]);
      var currentRightEyebrowSlope = calculateSlope(landmarks._positions[22], landmarks._positions[27]);
      // Calculate slope changes
      var leftEyebrowSlopeChange = Math.abs(currentLeftEyebrowSlope - neutralLeftEyebrowSlope);
      var rightEyebrowSlopeChange = Math.abs(currentRightEyebrowSlope - neutralRightEyebrowSlope);

      var eyebrowEyeDeviationLeft = Math.abs(neutralEyebrowEyeDistanceLeft - distanceEyebrowEyeLeft);
      var eyebrowEyeDeviationRight = Math.abs(neutralEyebrowEyeDistanceRight - distanceEyebrowEyeRight);

      // * Order of Emotions helps when one emotion is likely to be dominated by another
      if(lipDeviation >= lipDistanceThreshold){
        predictedEmotion = 'surprised';
      }
      else if(sadAngleThreshold < -1 * currentAngleDeviationLeft && sadAngleThreshold < -1 * currentAngleDeviationRight){
        predictedEmotion = 'sad';
      }
      else if(
        (eyebrowEyeDeviationLeft >= angerEyebrowEyeThreshold && eyebrowEyeDeviationRight >= angerEyebrowEyeThreshold) ||
        (leftEyebrowSlopeChange > angerSlopeThreshold && rightEyebrowSlopeChange > angerSlopeThreshold)
      ){
        predictedEmotion = 'angry';
      }
      else if(happyAngleThreshold < currentAngleDeviationLeft && happyAngleThreshold < currentAngleDeviationRight){
        predictedEmotion = 'happy';
      }
      else{
        predictedEmotion = 'neutral';
      }

      document.getElementById('currentEmotion').innerHTML = dominantEmotion;
      document.getElementById('predictedEmotion').innerHTML = predictedEmotion;
      document.getElementById('neutralLeftAngle').innerHTML = neutralLeftAngle;
      document.getElementById('neutralRightAngle').innerHTML = neutralRightAngle;
      document.getElementById('neutralDistanceLipTopBottom').innerHTML = neutralDistanceLipTopBottom;
      document.getElementById('neutralDistanceEyebrow').innerHTML = neutralDistanceEyebrow;
      document.getElementById('lipDeviation').innerHTML = lipDeviation;
      document.getElementById('eyebrowEyeDeviationLeft').innerHTML = eyebrowEyeDeviationLeft;
      document.getElementById('eyebrowEyeDeviationRight').innerHTML = eyebrowEyeDeviationRight;
      document.getElementById('slopeDeviationLeft').innerHTML = leftEyebrowSlopeChange;
      document.getElementById('slopeDeviationRight').innerHTML = rightEyebrowSlopeChange;
    }
    
    if($("#box-switch").is(":checked")){
      faceapi.draw.drawDetections(canvas, resizedDetections)
    }
    if($("#landmarks-switch").is(":checked")){
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
    }
    if($("#expression-switch").is(":checked")){
      faceapi.draw.drawFaceExpressions(canvas, resizedDetections)
    }
    if($("#age-gender-switch").is(":checked")){
      resizedDetections.forEach(result => {
        const { age, gender, genderProbability } = result
        new faceapi.draw.DrawTextField(
          [
            `${faceapi.round(age, 0)} years`,
            `${gender} (${faceapi.round(genderProbability)})`
          ],
          result.detection.box.bottomRight
        ).draw(canvas)
      })
    }
    if(!$(".loading").hasClass('d-none')){
      $(".loading").addClass('d-none')
    }
  }, 300)
}

function cameraStarted(){
  toggleContrl("detection-switch", true);
  $("#errorMsg").addClass("d-none");
  if( webcam.webcamList.length > 1){
    $("#cameraFlip").removeClass('d-none');
  }
}

function cameraStopped(){
  toggleContrl("detection-switch", false);
  $("#errorMsg").addClass("d-none");
  $("#cameraFlip").addClass('d-none');
}

function displayError(err = ''){
  if(err!=''){
      $("#errorMsg").html(err);
  }
  $("#errorMsg").removeClass("d-none");
}

function detectAnger(neutralLandmarks, currentLandmarks) {
  // Example: Check if the distance between eyebrows has decreased
  const neutralDistance = calculateDistance(neutralLandmarks[21], neutralLandmarks[22]); // Eyebrow inner ends
  const currentDistance = calculateDistance(currentLandmarks[21], currentLandmarks[22]);

  // Example: Check if the eyebrows are lowered
  const neutralAngle = calculateAngle(neutralLandmarks[19], neutralLandmarks[21], neutralLandmarks[24]);
  const currentAngle = calculateAngle(currentLandmarks[19], currentLandmarks[21], currentLandmarks[24]);

  if (currentDistance < neutralDistance * 0.9 && currentAngle < neutralAngle) {
      return true; // Anger detected
  }
  return false;
}


// Function to calculate the slope between two points
function calculateSlope(point1, point2) {
  if (point2.x === point1.x) return Infinity; // Avoid division by zero
  return Math.abs(point2.y - point1.y) / Math.abs(point2.x - point1.x);
}

// Function to calculate the angle between three points
function calculateAngle(p1, p2, p3) {
  // Calculate vectors
  var ux = p1.x - p2.x;
  var uy = p1.y - p2.y;
  var vx = p3.x - p2.x;
  var vy = p3.y - p2.y;
  
  // Calculate dot product
  var dotProduct = ux * vx + uy * vy;
  
  // Calculate magnitudes
  var magU = Math.sqrt(ux * ux + uy * uy);
  var magV = Math.sqrt(vx * vx + vy * vy);
  
  // Calculate angle in radians
  var radians = Math.acos(dotProduct / (magU * magV));
  
  // Convert radians to degrees
  var degrees = radians * (180 / Math.PI);
  
  return degrees;
}

// Function to calculate the distance between two points
function calculateDistance(p1, p2) {
  var dx = p2.x - p1.x;
  var dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

async function getDominantEmotion(expressions){
  let maxProbability = -1;
  let dominantEmotion = null;

  for (const [key, value] of Object.entries(expressions)) {
      if (value > maxProbability) {
          maxProbability = value;
          dominantEmotion = key;
      }
  }
  return dominantEmotion;
}
