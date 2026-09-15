// Prototype image set. These are 30 assessment views derived from four openly available sources.
// Replace with 30 independent inspection images before a scientific deployment.
const BASE_IMAGES = [
 {id:'commons-cc0',url:'https://upload.wikimedia.org/wikipedia/commons/8/82/Leading_edge_damage_-_windturbine.jpg',source:'Wikimedia Commons / Belzona Polymerics Ltd.',license:'CC0 1.0',sourceUrl:'https://commons.wikimedia.org/wiki/File:Leading_edge_damage_-_windturbine.jpg'},
 {id:'roboflow-1',url:'https://source.roboflow.com/V07KUEIfU6hiemy7y54a4pTeD072/1bK1h7dCSLpz2vFb3gP9/thumb.jpg',source:'LEEv1.4, Dubai International Academy / Roboflow Universe',license:'CC BY 4.0',sourceUrl:'https://universe.roboflow.com/dubai-international-academy/leev1.4'},
 {id:'roboflow-2',url:'https://source.roboflow.com/V07KUEIfU6hiemy7y54a4pTeD072/2XIpM3N0yZwSk7gH9LkT/thumb.jpg',source:'LEEv1.4, Dubai International Academy / Roboflow Universe',license:'CC BY 4.0',sourceUrl:'https://universe.roboflow.com/dubai-international-academy/leev1.4'},
 {id:'roboflow-3',url:'https://source.roboflow.com/V07KUEIfU6hiemy7y54a4pTeD072/3JaGOhA2yh3w1PbmPYcz/thumb.jpg',source:'LEEv1.4, Dubai International Academy / Roboflow Universe',license:'CC BY 4.0',sourceUrl:'https://universe.roboflow.com/dubai-international-academy/leev1.4'}
];
window.LEE_IMAGES = Array.from({length:30},(_,i)=>{
 const b=BASE_IMAGES[i%BASE_IMAGES.length];
 return {id:`P${String(i+1).padStart(2,'0')}`, ...b, id:`P${String(i+1).padStart(2,'0')}`, baseId:b.id,
   crop:{x:[50,42,58,48,55][i%5],y:[50,48,52,45,55][i%5],zoom:[1,1.15,1.3,1.45,1.6][i%5]}};
});
