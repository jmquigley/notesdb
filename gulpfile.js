const gulp = require('gulp');
const jsdoc = require('gulp-jsdoc3');

gulp.task('docs', function (cb) {
	let config = require('./jsdoc.json');

	gulp.src(['README.md', './lib/*.js'], {read: false})
		.pipe(jsdoc(config, cb));
});

gulp.task('default',gulp.series('docs', cb => {
	cb();
}));
