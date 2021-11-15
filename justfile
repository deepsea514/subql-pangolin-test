up:
  docker-compose up

clear:
  docker-compose rm -f
  rm -rf .data

types:
  yarn codegen

build:
  rm -rfv dist
  yarn build

bug: clear build up
sub: types build
