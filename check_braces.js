
import fs from 'fs';

const content = fs.readFileSync('c:/yoburaj/billing_app_frontend/app/shop/function-bill.tsx', 'utf8');

let stack = [];
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let j = 0; j < line.length; j++) {
        let char = line[j];
        if (char === '{') stack.push({ char, line: i + 1, col: j + 1 });
        if (char === '}') {
            if (stack.length === 0) {
                console.log(`Extra } at L${i + 1}:C${j + 1}`);
            } else {
                stack.pop();
            }
        }
        if (char === '(') stack.push({ char, line: i + 1, col: j + 1 });
        if (char === ')') {
            if (stack.length === 0) {
                console.log(`Extra ) at L${i + 1}:C${j + 1}`);
            } else {
                let last = stack.pop();
                if (last.char !== '(') console.log(`Mismatch: ) at L${i + 1}:C${j + 1} matches { from L${last.line}`);
            }
        }
        if (char === '[') stack.push({ char, line: i + 1, col: j + 1 });
        if (char === ']') {
            if (stack.length === 0) {
                console.log(`Extra ] at L${i + 1}:C${j + 1}`);
            } else {
                let last = stack.pop();
                if (last.char !== '[') console.log(`Mismatch: ] at L${i + 1}:C${j + 1} matches ${last.char} from L${last.line}`);
            }
        }
    }
}
if (stack.length > 0) {
    console.log('Unclosed delimiters:');
    stack.forEach(s => console.log(`${s.char} at L${s.line}:C${s.col}`));
} else {
    console.log('Balanced!');
}
