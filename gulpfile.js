let fs = require('fs');
let gulp = require('gulp');
let browserSync = require('browser-sync').create();


let pug = require('gulp-pug');
let htmlbeautify = require('gulp-html-beautify');
let pugLinter = require('gulp-pug-lint');

let sass = require('gulp-sass');
let autoprefixer = require('autoprefixer');

let concat = require('gulp-concat');
const uglify = require('gulp-uglify');
let sourcemaps = require('gulp-sourcemaps');

let newer = require('gulp-newer');

// Получение настроек проекта из projectConfig.json
let projectConfig = require('./projectConfig.json');
let dirs = projectConfig.dirs;
let lists = getFilesList(projectConfig);

// Сообщение, записываемое в стилевой файл
let StyleFileMsg = '/*!*\n * ВНИМАНИЕ! Этот файл генерируется автоматически.\n * Не пишите сюда ничего вручную, все такие правки будут потеряны при следующей компиляции.\n * Читайте ./README.md для понимания.\n */\n\n';

// Формирование и запись диспетчера подключений (style.scss), который компилируется в style.min.css
let styleImports = StyleFileMsg;
lists.css.forEach(function (blockPath) {
    styleImports += '@import \'' + blockPath + '\';\n';
});
fs.writeFileSync(dirs.srcPath + 'sass/main.scss', styleImports);

let PugFileMsg = '//- ВНИМАНИЕ! Этот файл генерируется автоматически. Не пишите сюда ничего вручную!\n//- Читайте ./README.md для понимания.\n\n';

// Формирование и запись списка примесей (mixins.pug) со списком инклудов всех pug-файлов блоков
lists.pug.forEach(function(blockPath) {
    PugFileMsg += 'include '+blockPath+'\n';
});
fs.writeFileSync(dirs.srcPath + 'html/mixins/mixins.pug', PugFileMsg);

gulp.task('html', function(){
    return gulp.src('src/html/pages/*.pug')
        .pipe(pug())
        .pipe(htmlbeautify())
        .pipe(gulp.dest('dist'))
});

gulp.task('css', function(){
    return gulp.src('src/sass/main.scss')
        .pipe(sass())
        .pipe(gulp.dest('dist/css'))
});

gulp.task('js', function(){
    if(lists.js.length > 0){
        console.log('---------- Обработка JS');
        return gulp.src(lists.js)
          .pipe(concat('main.min.js'))
          .pipe(uglify())
          .pipe(gulp.dest(dirs.buildPath + '/js'));
      }
      else {
        console.log('---------- Обработка JS: в сборке нет JS-файлов');
      }
});

// Копирование изображений
gulp.task('copy:img', function () {
    console.log('---------- Копирование изображений');
    return gulp.src(dirs.srcPath + '/img/*.{jpg,jpeg,gif,png,svg}')
        .pipe(newer(dirs.buildPath + '/img'))  // оставить в потоке только изменившиеся файлы
        .pipe(gulp.dest(dirs.buildPath + '/img'));
});

// Копирование изображений блоков
gulp.task('copy:imgblocks', function () {
    console.log('---------- Копирование изображений блоков');
    return gulp.src(lists.img)
        .pipe(newer(dirs.buildPath + '/img'))  // оставить в потоке только изменившиеся файлы
        .pipe(gulp.dest(dirs.buildPath + '/img'));
});

// Копирование шрифтов
gulp.task('copy:fonts', function () {
    console.log('---------- Копирование шрифтов');
    return gulp.src(dirs.srcPath + '/fonts/*.{ttf,woff,woff2,eot,svg}')
        .pipe(newer(dirs.buildPath + '/fonts'))  // оставить в потоке только изменившиеся файлы
        .pipe(gulp.dest(dirs.buildPath + '/fonts'));
});

// Сборка всего
gulp.task('build', gulp.series(
    gulp.parallel('css', 'js', 'copy:img', 'copy:fonts'),
    'html'
));

gulp.task('serve', gulp.series('build', function () {

    browserSync.init({
        server: dirs.buildPath,
        port: 8080,
        startPath: 'index.html',
        open: false,
    });

    // Стили
    let stylePaths = [
        dirs.srcPath + 'sass/main.scss',
        dirs.srcPath + 'sass/**/*.scss'
    ];
    for (let i = 0, len = lists.blocksDirs.length; i < len; ++i) {
        stylePaths.push(dirs.srcPath + lists.blocksDirs[i] + '*.scss');
    }
    gulp.watch(stylePaths, gulp.series('css'));

    // Изображения
    if (lists.img.length) {
        gulp.watch(lists.img, gulp.series('copy:imgblocks', reload));
    }
    gulp.watch(dirs.srcPath + 'img/*.{jpg,jpeg,gif,png,svg}', gulp.series('copy:img', reload));

    // Шрфты
    gulp.watch(dirs.srcPath + 'fonts/*.{ttf,woff,woff2,eot,svg}', gulp.series('copy:fonts', reload));

    // Pug-файлы
    let pugPaths = [
        dirs.srcPath + '**/*.pug',

    ];
    for (let i = 0, len = lists.blocksDirs.length; i < len; ++i) {
        pugPaths.push(dirs.srcPath + lists.blocksDirs[i] + '*.pug');
    }
    // console.log(pugPaths);

    gulp.watch(pugPaths, gulp.series('html', reload));

    // JS-файлы блоков
    if (lists.js.length) {
        gulp.watch(lists.js, gulp.series('js', reload));
    }

}));

gulp.task('default', gulp.series('serve'));

/**
 * Вернет объект с обрабатываемыми файлами и папками
 * @param  {object}
 * @return {object}
 */
function getFilesList(config) {

    let res = {
        'css': [],
        'js': [],
        'img': [],
        'pug': [],
        'blocksDirs': [],
    };

    // Обходим массив с блоками проекта
    for (let blockName in config.blocks) {
        let blockPath = config.dirs.srcPath + config.dirs.blocksDirName + '/' + blockName + '/';

        if (fileExist(blockPath)) {

            // Разметка (Pug)
            if (fileExist(blockPath + blockName + '.pug')) {
                res.pug.push('../../' + config.dirs.blocksDirName + '/' + blockName + '/' + blockName + '.pug');
                // TODO переделать так, чтобы можно было использовать в вотчере
            }
            else {
                console.log('---------- блок ' + blockName + ' указан как используемый, но не имеет pug-файла.');
            }

            // Стили
            if (fileExist(blockPath + blockName + '.scss')) {
                res.css.push(blockPath + blockName + '.scss');
                if (config.blocks[blockName].length) {
                    config.blocks[blockName].forEach(function (elementName) {
                        if (fileExist(blockPath + blockName + elementName + '.scss')) {
                            res.css.push(blockPath + blockName + elementName + '.scss');
                        }
                    });
                }
            }
            else {
                console.log('---------- блок ' + blockName + ' указан как используемый, но не имеет scss-файла.');
            }

            // Скрипты
            if (fileExist(blockPath + blockName + '.js')) {
                res.js.push(blockPath + blockName + '.js');
                if (config.blocks[blockName].length) {
                    config.blocks[blockName].forEach(function (elementName) {
                        if (fileExist(blockPath + blockName + elementName + '.js')) {
                            res.js.push(blockPath + blockName + elementName + '.js');
                        }
                    });
                }
            }
            else {
                // console.log('---------- блок ' + blockName + ' указан как используемый, но не имеет JS-файла.');
            }

            // Картинки (тупо от всех блоков, без проверки)
            res.img.push(config.dirs.srcPath + config.dirs.blocksDirName + '/' + blockName + '/img/*.{jpg,jpeg,gif,png,svg}');

            // Список директорий
            res.blocksDirs.push(config.dirs.blocksDirName + '/' + blockName + '/');

        }
        else {
            console.log('ERR ------ блок ' + blockPath + ' указан как используемый, но такой папки нет!');
        }

    }

    res.css = config.addSass.concat(res.css);
    res.js = res.js.concat(config.addJsAfter);
    res.js = config.addJsBefore.concat(res.js);
    return res;
}

/**
 * Проверка существования файла или папки
 * @param  {string} path      Путь до файла или папки]
 * @return {boolean}
 */
function fileExist(filepath) {
    let flag = true;
    try {
        fs.accessSync(filepath, fs.F_OK);
    } catch (e) {
        flag = false;
    }
    return flag;
}

// Перезагрузка браузера
function reload(done) {
    browserSync.reload();
    done();
}
