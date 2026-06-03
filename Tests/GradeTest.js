const DISTRICT_URL = '-';
const USERNAME = '-';
const PASSWORD = '-';
const StudentVue = require('studentvue.js');
StudentVue.login(DISTRICT_URL, USERNAME, PASSWORD)
  .then(client => client.getGradebook())
  .then(data => {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
 
    // Print raw structure first so you can see what's available
    console.log('Top-level keys:', Object.keys(parsed));
 
    const gradebook = parsed?.Gradebook;
    if (!gradebook) {
      console.log('No Gradebook found. Full response:');
      console.log(JSON.stringify(parsed, null, 2));
      return;
    }
 
    const courses = gradebook?.Courses?.Course;
    if (!courses) {
      console.log('No courses found. Gradebook keys:', Object.keys(gradebook));
      return;
    }
 
    // Normalize to array in case there's only one course
    const courseList = Array.isArray(courses) ? courses : [courses];
 
    courseList.forEach(course => {
  // 1. Extract Title (accounting for attribute prefix or nested object)
  const title = course['@_Title'] || course.Title || 'Unknown Course';
  
  // 2. Synergy often stores the actual mark inside an array/object called 'Marks'
  // Let's check for the direct attributes first, then fallback to the Marks object
  let grade = course['@_CalculatedScoreString'] || course.CalculatedScoreString;
  let raw = course['@_CalculatedScoreRaw'] || course.CalculatedScoreRaw;

  // FALLBACK: If the top level is empty, check the nested Marks array (very common in Synergy)
  if (!grade && course.Marks && course.Marks.Mark) {
    const marksList = Array.isArray(course.Marks.Mark) ? course.Marks.Mark : [course.Marks.Mark];
    // Grab the first mark (usually the current grading period)
    if (marksList[0]) {
      grade = marksList[0]['@_CalculatedScoreString'] || marksList[0].CalculatedScoreString;
      raw = marksList[0]['@_CalculatedScoreRaw'] || marksList[0].CalculatedScoreRaw;
    }
  }

  // 3. Final default fallback if everything above failed
  grade = grade || 'N/A';
  raw = raw || 'N/A';

  console.log(`${title}: ${grade} (${raw}%)`);
});
  })
  .catch(err => console.error('Error:', err));