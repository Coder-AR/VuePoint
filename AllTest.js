const StudentVue = require('studentvue.js');
const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise(resolve => rl.question(question, resolve));

function parse(data) {
  return typeof data === 'string' ? JSON.parse(data) : data;
}

async function selectDistrict() {
  const zip = await ask('Enter your zip code to search for districts: ');
  console.log('Searching...');

  const rawResults = await StudentVue.getDistrictUrls(zip.trim());
  const results = parse(rawResults);
  const districts = results?.DistrictLists?.DistrictInfos?.DistrictInfo;

  if (!districts) {
    console.log('No districts found for that zip code.');
    console.log('Raw API Response:', JSON.stringify(results, null, 2));
    return null;
  }

  const districtList = Array.isArray(districts) ? districts : [districts];

  console.log('\nDistricts found:');
  districtList.forEach((d, i) => {
    const name = d.Name   || 'Unknown';
    const url  = d.PvueURL || 'N/A';
    console.log(`  [${i + 1}] ${name} — ${url}`);
  });

  const choice = await ask('\nSelect a district by number: ');
  const index = parseInt(choice.trim()) - 1;

  if (isNaN(index) || index < 0 || index >= districtList.length) {
    console.log('Invalid selection.');
    return null;
  }

  return districtList[index].PvueURL;
}

async function promptCredentials() {
  const username = await ask('Username: ');

  const password = await new Promise(resolve => {
    // 1. Define the exact prompt string
    const promptText = 'Password: ';

    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      // 2. FIX: If Node is printing the initial prompt, let it through unmasked
      if (stringToWrite === promptText) {
        rl.output.write(stringToWrite);
        return;
      }

      // If readline is trying to move the cursor or clear lines, let it pass
      if (stringToWrite.match(/^(\x1b\[\d+[A-D]|\x1b\[K)/)) {
        rl.output.write(stringToWrite);
        return;
      }
      
      // Mask the actual typed keys
      if (stringToWrite.trim() !== '') {
        rl.output.write('*'); // Or use '' if you want it completely invisible/blank!
      } else {
        rl.output.write(stringToWrite);
      }
    };

    // 3. Make sure the prompt text passed here matches your variable above perfectly
    rl.question(promptText, (input) => {
      delete rl._writeToOutput; 
      resolve(input);
    });
  });

  return { username: username.trim(), password };
}

function fetchStudentInfo(client) {
  return client.getStudentInfo().then(data => {
    const parsed = parse(data);
    const info = parsed?.StudentInfo;

    if (!info) {
      console.log('No student info found.');
      return;
    }

    console.log('\n=== Student Info ===');
    console.log(`Name:   ${info['@_FormattedName'] || info.FormattedName || 'N/A'}`);
    console.log(`Grade:  ${info['@_Grade']         || info.Grade         || 'N/A'}`);
    console.log(`School: ${info['@_SchoolName']    || info.SchoolName    || 'N/A'}`);

    const photo = info.Photo;
    if (photo) {
      const buffer = Buffer.from(photo, 'base64');
      fs.writeFileSync('student-photo.png', buffer);
      console.log('Photo:  saved to student-photo.png');
    } else {
      console.log('Photo:  not found');
    }
  });
}

function fetchGrades(client) {
  return client.getGradebook().then(data => {
    const parsed = parse(data);
    const courses = parsed?.Gradebook?.Courses?.Course;

    if (!courses) {
      console.log('\nNo gradebook data found.');
      return;
    }

    const courseList = Array.isArray(courses) ? courses : [courses];

    console.log('\n=== Grades ===');
    courseList.forEach(course => {
      const title  = course.Title  || 'Unknown';
      const period = course.Period || '?';

      const currentMark = course.Marks?.Mark?.[0] || course.Marks?.Mark;
      const grade = currentMark?.CalculatedScoreString || 'N/A';
      const raw   = currentMark?.CalculatedScoreRaw    || 'N/A';

      console.log(`  [P${period}] ${title}: ${grade} (${raw}%)`);
    });
  });
}

async function main() {
  try {
    const districtUrl = await selectDistrict();
    if (!districtUrl) {
      rl.close();
      return;
    }

    console.log('');
    const { username, password } = await promptCredentials();
    rl.close();

    console.log('\nLogging in...');
    const client = await StudentVue.login(districtUrl, username, password);
    console.log('Logged in successfully.');

    await fetchStudentInfo(client);
    await fetchGrades(client);

    console.log('\nDone.');
  } catch (err) {
    rl.close();
    console.error('Error:', err);
  }
}

main();
