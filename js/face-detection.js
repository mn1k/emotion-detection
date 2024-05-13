const webcamElement = document.getElementById('webcam');
const webcam = new Webcam(webcamElement, 'user');
const modelPath = 'models';
let currentStream;
let displaySize;
let convas;
let faceDetection;

webcam.start()
cameraStarted();

var neutralLeftAngle = 0;
var neutralRightAngle = 0;
var neutralDistanceLipTopBottom = 0;
var neutralDistanceEyebrow = 0

var happyAngleThreshold = 5;
var sadAngleThreshold = 2;
var lipDistanceThreshold = 10;
var eyebrowDistanceThreshold = 0;
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
    // const detections = await faceapi.detectSingleFace(webcamElement, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true).withFaceExpressions().withAgeAndGender()
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
      const jawLeft = landmarks._positions[3]
      const jawRight = landmarks._positions[13]
      const eyebrowLeftCenter = landmarks._positions[21]
      const eyebrowRightCentre = landmarks._positions[22]

      // Calculate angle
      var leftAngle = calculateAngle(noseTop, noseBottom, lipLeft);
      var rightAngle = calculateAngle(noseTop, noseBottom, lipRight);
      var distanceLipTopBottom = calculateDistance(lipTop, lipBottom);
      var distanceEyebrow = calculateDistance(eyebrowRightCentre, eyebrowLeftCenter);

      var dominantEmotion = await getDominantEmotion(detections[0].expressions);

      if (dominantEmotion == 'neutral' && flag == 0) {
        neutralLeftAngle = Math.max(neutralLeftAngle, leftAngle);
        neutralRightAngle = Math.max(neutralRightAngle, rightAngle);
        neutralDistanceLipTopBottom = Math.max(neutralDistanceLipTopBottom, distanceLipTopBottom);
        neutralDistanceEyebrow = Math.max(neutralDistanceEyebrow, distanceEyebrow);
        flag = 1;
      }

      var currentAngleDeviationRight = neutralLeftAngle - leftAngle;
      var currentAngleDeviationLeft = neutralRightAngle - rightAngle;
      var lipDeviation = distanceLipTopBottom - neutralDistanceLipTopBottom;
      var eyebrowDeviation = distanceEyebrow - neutralDistanceEyebrow;

      if(happyAngleThreshold < currentAngleDeviationLeft && happyAngleThreshold < currentAngleDeviationRight){
        predictedEmotion = 'happy';
      }
      else if(lipDeviation >= lipDistanceThreshold){
        predictedEmotion = 'surprised';
      }
      else if(sadAngleThreshold < -1 * currentAngleDeviationLeft && sadAngleThreshold < -1 * currentAngleDeviationRight){
        predictedEmotion = 'sad';
      }
      else if(eyebrowDeviation <= eyebrowDistanceThreshold){
        predictedEmotion = 'angry';
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
      document.getElementById('currentLeftAngle').innerHTML = leftAngle;
      document.getElementById('currentRightAngle').innerHTML = rightAngle;
      document.getElementById('currentAngleDeviationLeft').innerHTML = currentAngleDeviationLeft;
      document.getElementById('currentAngleDeviationRight').innerHTML = currentAngleDeviationRight;
      document.getElementById('lipDeviation').innerHTML = lipDeviation;
      document.getElementById('eyebrowDeviation').innerHTML = eyebrowDeviation;
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
